module.exports = [
"[project]/app/components/checkout/contextoCheckout.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CheckoutProvider",
    ()=>CheckoutProvider,
    "useCheckout",
    ()=>useCheckout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const CheckoutContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function CheckoutProvider({ children }) {
    const [isOpen, setIsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [passo, setPasso] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(1);
    const [dados, setDados] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [breakdown, setBreakdown] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const abrirCheckout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(({ slug, ticketId, quantity = 1, price = null, ticketName = null, eventId = null, userId = null, waves, additional, pairingId = null, pairingSlotId = null, ticketTypeId = null })=>{
        setDados((prev)=>{
            const safeWaves = Array.isArray(waves) ? waves : prev?.waves && Array.isArray(prev.waves) ? prev.waves : [];
            const safeAdditional = additional && typeof additional === "object" ? additional : prev?.additional ?? {};
            return {
                slug,
                ticketId,
                quantity,
                price,
                ticketName,
                eventId,
                userId,
                waves: safeWaves,
                pairingId,
                pairingSlotId,
                ticketTypeId,
                additional: safeAdditional
            };
        });
        setPasso(1);
        setIsOpen(true);
    }, []);
    const fecharCheckout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setIsOpen(false);
        setPasso(1);
        setDados(null);
        setBreakdown(null);
    }, []);
    const irParaPasso = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((novoPasso)=>{
        setPasso(novoPasso);
    }, []);
    const atualizarDados = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((patch)=>{
        setDados((prev)=>prev ? {
                ...prev,
                ...patch
            } : prev);
    }, []);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            isOpen,
            passo,
            dados,
            breakdown,
            setBreakdown,
            abrirCheckout,
            fecharCheckout,
            irParaPasso,
            atualizarDados
        }), [
        isOpen,
        passo,
        dados,
        breakdown,
        abrirCheckout,
        fecharCheckout,
        irParaPasso,
        atualizarDados
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(CheckoutContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/app/components/checkout/contextoCheckout.tsx",
        lineNumber: 171,
        columnNumber: 5
    }, this);
}
function useCheckout() {
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(CheckoutContext);
    if (!ctx) {
        throw new Error("useCheckout deve ser usado dentro de um CheckoutProvider");
    }
    return ctx;
}
}),
"[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>WavesSectionClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function formatDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}
function computeRemainingAndStatus(prev, updated) {
    const total = updated.totalQuantity !== undefined ? updated.totalQuantity : prev.totalQuantity ?? null;
    const sold = updated.soldQuantity !== undefined ? updated.soldQuantity : prev.soldQuantity ?? 0;
    let remaining = null;
    if (total === null || total === undefined) {
        remaining = null; // ilimitado
    } else {
        const diff = total - sold;
        remaining = diff < 0 ? 0 : diff;
    }
    let status = prev.status;
    if (total !== null && total !== undefined && sold >= total) {
        status = "sold_out";
    } else if (status === "sold_out") {
        status = "sold_out";
    }
    // Se estiver marcada como indisponível/oculta, tratamos como encerrada visualmente
    if (!prev.available || !prev.isVisible) {
        status = "closed";
    }
    return {
        remaining,
        status
    };
}
function WavesSectionClient({ slug, tickets: initialTickets, isFreeEvent, checkoutUiVariant = "DEFAULT", padelMeta, inviteEmail }) {
    const { abrirCheckout, atualizarDados } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    const [tickets, setTickets] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialTickets);
    const [loadingId, setLoadingId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [feedback, setFeedback] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const inviteAdditional = inviteEmail && inviteEmail.trim() ? {
        guestEmail: inviteEmail.trim(),
        guestEmailConfirm: inviteEmail.trim()
    } : {};
    async function handlePurchase(ticketId) {
        const selectedTicket = tickets.find((t)=>t.id === ticketId);
        if (!selectedTicket) return;
        // limpar feedback antigo
        setFeedback((prev)=>{
            const clone = {
                ...prev
            };
            delete clone[ticketId];
            return clone;
        });
        setLoadingId(ticketId);
        try {
            // Todo o checkout (pago ou grátis) passa pelo modal/core único.
            abrirCheckout({
                slug,
                ticketId,
                price: selectedTicket.price,
                ticketName: selectedTicket.name,
                eventId: padelMeta?.eventId ? String(padelMeta.eventId) : undefined,
                additional: {
                    checkoutUiVariant,
                    padelMeta,
                    ...inviteAdditional
                },
                waves: tickets
            });
        } catch (err) {
            console.error(err);
            setFeedback((prev)=>({
                    ...prev,
                    [ticketId]: {
                        type: "error",
                        message: "Erro inesperado ao processar a ação. Tenta outra vez."
                    }
                }));
        } finally{
            setLoadingId(null);
        }
    }
    const visibleTickets = tickets.filter((t)=>t.isVisible);
    const purchasableTickets = visibleTickets.filter((t)=>t.status === "on_sale" || t.status === "upcoming");
    // 🔥 Calcular preço mínimo (defensivo para o caso de não haver bilhetes visíveis)
    const minPrice = purchasableTickets.length > 0 ? Math.min(...purchasableTickets.map((t)=>t.price)) : null;
    const isFreeLabel = Boolean(isFreeEvent);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-6 w-full",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-2xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.14),rgba(4,8,20,0.85))] px-5 py-4 backdrop-blur-xl flex flex-col gap-3 shadow-[0_0_35px_rgba(0,0,0,0.55)]",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-white/85 text-sm",
                    children: isFreeLabel ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-white font-semibold",
                        children: "Entrada gratuita"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/WavesSectionClient.tsx",
                        lineNumber: 179,
                        columnNumber: 13
                    }, this) : minPrice !== null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            "A partir de",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-white font-semibold",
                                children: [
                                    minPrice.toFixed(2),
                                    "€"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/eventos/[slug]/WavesSectionClient.tsx",
                                lineNumber: 183,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-white/60",
                        children: "Sem bilhetes disponíveis"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/WavesSectionClient.tsx",
                        lineNumber: 188,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/WavesSectionClient.tsx",
                    lineNumber: 177,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    disabled: purchasableTickets.length === 0,
                    onClick: ()=>{
                        if (purchasableTickets.length === 0) return;
                        atualizarDados({
                            slug,
                            waves: visibleTickets,
                            additional: {
                                checkoutUiVariant,
                                padelMeta,
                                ...inviteAdditional
                            }
                        });
                        const defaultTicket = purchasableTickets[0];
                        abrirCheckout({
                            slug,
                            ticketId: defaultTicket.id,
                            price: defaultTicket.price,
                            ticketName: defaultTicket.name,
                            eventId: padelMeta?.eventId ? String(padelMeta.eventId) : undefined,
                            additional: {
                                checkoutUiVariant,
                                padelMeta,
                                ...inviteAdditional
                            },
                            waves: visibleTickets
                        });
                        setTimeout(()=>{
                            try {
                                const evt = new Event("orya-force-step1");
                                window.dispatchEvent(evt);
                            } catch  {}
                        }, 10);
                    },
                    className: "w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold py-3 shadow-[0_0_20px_rgba(107,255,255,0.45)] hover:scale-[1.02] active:scale-95 transition-transform text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                    children: purchasableTickets.length === 0 ? "Esgotado" : isFreeLabel ? "Garantir lugar" : "Comprar agora"
                }, void 0, false, {
                    fileName: "[project]/app/eventos/[slug]/WavesSectionClient.tsx",
                    lineNumber: 192,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/eventos/[slug]/WavesSectionClient.tsx",
            lineNumber: 176,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/WavesSectionClient.tsx",
        lineNumber: 175,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/components/checkout/Step1Bilhete.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Step1Bilhete
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function Step1Bilhete() {
    const { dados, irParaPasso, fecharCheckout, atualizarDados } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    const safeDados = dados && typeof dados === "object" ? dados : {
        waves: [],
        additional: {}
    };
    const normalizeStatus = (status)=>(status || "on_sale").toLowerCase();
    const stableWaves = Array.isArray(safeDados.waves) ? [
        ...safeDados.waves
    ].map((w)=>({
            ...w,
            status: normalizeStatus(w.status)
        })) : [];
    const cheapestAvailable = [
        ...stableWaves
    ].filter((w)=>{
        const st = normalizeStatus(w.status);
        return st !== "sold_out" && st !== "closed";
    }).sort((a, b)=>(a.price ?? 0) - (b.price ?? 0))[0];
    const hasWaves = stableWaves.length > 0;
    // 🧮 Quantidades iniciais por wave (memoizado para não recriar em cada render)
    const initialQuantidades = {};
    for (const w of stableWaves){
        const rawQty = typeof w.quantity === "number" && w.quantity > 0 ? w.quantity : 0;
        const remaining = typeof w.remaining === "number" && w.remaining >= 0 ? w.remaining : null;
        const maxForWave = remaining === null ? Number.MAX_SAFE_INTEGER : Math.max(0, remaining);
        initialQuantidades[w.id] = Math.min(rawQty, maxForWave);
    }
    const variant = (typeof safeDados.additional?.checkoutUiVariant === "string" ? safeDados.additional.checkoutUiVariant : "DEFAULT").toUpperCase();
    const isPadelVariant = variant === "PADEL";
    const padelMeta = safeDados.additional?.padelMeta ?? null;
    const [quantidades, setQuantidades] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialQuantidades);
    const padelCategoryOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!isPadelVariant) return [];
        const map = new Map();
        for (const wave of stableWaves){
            const linkId = typeof wave.padelCategoryLinkId === "number" ? wave.padelCategoryLinkId : null;
            const categoryId = typeof wave.padelCategoryId === "number" ? wave.padelCategoryId : null;
            if (!linkId && !categoryId) continue;
            const key = linkId ? `link:${linkId}` : `cat:${categoryId}`;
            if (map.has(key)) continue;
            const label = wave.padelCategoryLabel?.trim() || (categoryId ? `Categoria ${categoryId}` : linkId ? `Categoria ${linkId}` : "Categoria");
            map.set(key, {
                key,
                linkId,
                categoryId,
                label
            });
        }
        return Array.from(map.values());
    }, [
        isPadelVariant,
        stableWaves
    ]);
    const [selectedPadelCategoryKey, setSelectedPadelCategoryKey] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>{
        if (!isPadelVariant) return null;
        if (padelMeta?.categoryLinkId) return `link:${padelMeta.categoryLinkId}`;
        if (padelMeta?.categoryId) return `cat:${padelMeta.categoryId}`;
        return padelCategoryOptions[0]?.key ?? null;
    });
    const [padelSelection, setPadelSelection] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("INDIVIDUAL");
    const [padelJoinMode, setPadelJoinMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("LOOKING_FOR_PARTNER");
    const [partnerContact, setPartnerContact] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [partnerError, setPartnerError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [padelStockError, setPadelStockError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [partnerResults, setPartnerResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [partnerLoading, setPartnerLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [partnerSelected, setPartnerSelected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const partnerSelectedLabel = partnerSelected?.label ?? "";
    const searchAbortRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const partnerRequired = padelJoinMode === "INVITE_PARTNER";
    const hasPartnerContact = partnerContact.trim().length > 0;
    const canContinuePadel = !partnerRequired || hasPartnerContact;
    // Qual wave está expandida (tipo acordeão)
    const [aberto, setAberto] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(cheapestAvailable?.id ?? stableWaves[0]?.id ?? null);
    // 💰 Totais para mostrar apenas (backend recalcula sempre)
    const { total, selectedQty } = stableWaves.reduce((acc, w)=>{
        const q = quantidades[w.id] ?? 0;
        const price = typeof w.price === "number" ? w.price : 0;
        return {
            total: acc.total + q * price,
            selectedQty: acc.selectedQty + q
        };
    }, {
        total: 0,
        selectedQty: 0
    });
    function toggleWave(id) {
        setAberto((prev)=>prev === id ? null : id);
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!isPadelVariant) return;
        if (padelCategoryOptions.length === 0) {
            if (selectedPadelCategoryKey !== null) {
                setSelectedPadelCategoryKey(null);
            }
            return;
        }
        const desiredKey = padelMeta?.categoryLinkId ? `link:${padelMeta.categoryLinkId}` : padelMeta?.categoryId ? `cat:${padelMeta.categoryId}` : null;
        const hasCurrent = selectedPadelCategoryKey ? padelCategoryOptions.some((opt)=>opt.key === selectedPadelCategoryKey) : false;
        if (hasCurrent) return;
        if (desiredKey && padelCategoryOptions.some((opt)=>opt.key === desiredKey)) {
            setSelectedPadelCategoryKey(desiredKey);
        } else {
            setSelectedPadelCategoryKey(padelCategoryOptions[0].key);
        }
    }, [
        isPadelVariant,
        padelCategoryOptions,
        padelMeta?.categoryId,
        padelMeta?.categoryLinkId,
        selectedPadelCategoryKey
    ]);
    const selectedPadelCategory = padelCategoryOptions.find((opt)=>opt.key === selectedPadelCategoryKey) ?? null;
    const resolvedPadelMeta = padelMeta ? {
        ...padelMeta,
        categoryId: selectedPadelCategory?.categoryId ?? padelMeta.categoryId ?? null,
        categoryLinkId: selectedPadelCategory?.linkId ?? padelMeta.categoryLinkId ?? null
    } : null;
    const padelCategoryRequired = isPadelVariant && padelCategoryOptions.length > 1;
    const padelCategorySelected = !padelCategoryRequired || Boolean(selectedPadelCategory);
    const padelFilteredWaves = isPadelVariant && selectedPadelCategory ? stableWaves.filter((w)=>{
        if (selectedPadelCategory.linkId) return w.padelCategoryLinkId === selectedPadelCategory.linkId;
        if (selectedPadelCategory.categoryId) return w.padelCategoryId === selectedPadelCategory.categoryId;
        return true;
    }) : stableWaves;
    const padelCandidateWave = padelFilteredWaves.find((w)=>{
        const st = normalizeStatus(w.status);
        return st !== "sold_out" && st !== "closed";
    }) ?? padelFilteredWaves[0] ?? null;
    const padelRemainingSlots = typeof padelCandidateWave?.remaining === "number" ? padelCandidateWave.remaining : null;
    const padelHasPairSlots = padelCandidateWave ? padelRemainingSlots === null ? true : padelRemainingSlots >= 2 : false;
    // Sugestões de parceiro (procura por @username/nome)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (padelJoinMode !== "INVITE_PARTNER") {
            setPartnerResults([]);
            return;
        }
        const term = partnerContact.trim();
        if (partnerSelected && term === partnerSelected.label) {
            setPartnerResults([]);
            return;
        }
        if (term.length < 2) {
            setPartnerResults([]);
            return;
        }
        if (searchAbortRef.current) {
            searchAbortRef.current.abort();
        }
        const controller = new AbortController();
        searchAbortRef.current = controller;
        const timeout = setTimeout(async ()=>{
            try {
                setPartnerLoading(true);
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`, {
                    signal: controller.signal
                });
                const json = await res.json().catch(()=>null);
                if (!res.ok || !json?.ok) {
                    setPartnerResults([]);
                } else {
                    setPartnerResults(Array.isArray(json.results) ? json.results : []);
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    setPartnerResults([]);
                }
            } finally{
                setPartnerLoading(false);
            }
        }, 300);
        return ()=>{
            clearTimeout(timeout);
            controller.abort();
        };
    }, [
        partnerContact,
        padelJoinMode,
        partnerSelectedLabel
    ]);
    function getMaxForWave(waveId) {
        const wave = stableWaves.find((w)=>w.id === waveId);
        if (!wave) return Number.MAX_SAFE_INTEGER;
        const remaining = typeof wave.remaining === "number" && wave.remaining >= 0 ? wave.remaining : null;
        return remaining === null ? Number.MAX_SAFE_INTEGER : Math.max(0, remaining);
    }
    function handleIncrement(id) {
        const maxAllowed = getMaxForWave(id);
        setQuantidades((prev)=>{
            const current = prev[id] ?? 0;
            if (current >= maxAllowed) return prev;
            return {
                ...prev,
                [id]: current + 1
            };
        });
    }
    function handleDecrement(id) {
        setQuantidades((prev)=>({
                ...prev,
                [id]: Math.max(0, (prev[id] ?? 0) - 1)
            }));
    }
    function handleContinuar() {
        if (variant === "PADEL") {
            if (padelCategoryRequired && !selectedPadelCategory) {
                setPadelStockError("Seleciona primeiro uma categoria.");
                return;
            }
            const target = padelCandidateWave;
            if (!target || !padelHasPairSlots) {
                setPadelStockError("Sem vagas suficientes para criar uma dupla.");
                return;
            }
            // Em modos com convite (INVITE_PARTNER), obrigar a indicar contacto do parceiro
            if (partnerRequired && !hasPartnerContact) {
                setPartnerError("Indica o contacto do parceiro para enviarmos o convite.");
                return;
            }
            if (padelStockError) setPadelStockError(null);
            setPartnerError(null);
            const scenario = padelSelection === "DUO_FULL" ? "GROUP_FULL" : "GROUP_SPLIT";
            // Criar (ou reusar) pairing antes de avançar
            const paymentMode = scenario === "GROUP_FULL" ? "FULL" : "SPLIT";
            const createPairing = async ()=>{
                if (!resolvedPadelMeta?.eventId) return null;
                try {
                    const res = await fetch("/api/padel/pairings", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            eventId: resolvedPadelMeta.eventId,
                            organizerId: resolvedPadelMeta.organizerId ?? undefined,
                            categoryId: resolvedPadelMeta.categoryId ?? undefined,
                            paymentMode,
                            pairingJoinMode: padelJoinMode,
                            invitedContact: padelJoinMode === "INVITE_PARTNER" && partnerContact.trim() ? partnerContact.trim() : undefined
                        })
                    });
                    const json = await res.json().catch(()=>null);
                    if (!res.ok || !json?.ok || !json?.pairing?.id) {
                        throw new Error(json?.error || "Falha ao preparar inscrição Padel.");
                    }
                    const pairing = json.pairing;
                    const slot = pairing.slots?.find((s)=>(s.slot_role ?? s.slotRole) === "CAPTAIN") ?? pairing.slots?.[0] ?? null;
                    return {
                        pairingId: pairing.id,
                        slotId: slot?.id ?? null
                    };
                } catch (err) {
                    console.error("[Step1Bilhete] pairing padel", err);
                    alert(err instanceof Error ? err.message : "Erro ao preparar inscrição Padel.");
                    return null;
                }
            };
            void createPairing().then((pairingResult)=>{
                if (!pairingResult?.pairingId) return;
                if ((scenario === "GROUP_FULL" || scenario === "GROUP_SPLIT") && !pairingResult.slotId) {
                    alert("Não foi possível identificar o teu slot na dupla. Atualiza a página e tenta novamente.");
                    return;
                }
                const nextQuantidades = {
                    [target.id]: scenario === "GROUP_FULL" ? 2 : 1
                };
                const totalCalc = (target.price ?? 0) * (scenario === "GROUP_FULL" ? 2 : 1);
                atualizarDados({
                    paymentScenario: scenario,
                    additional: {
                        ...safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {},
                        quantidades: nextQuantidades,
                        total: totalCalc,
                        padelJoinMode,
                        checkoutUiVariant: variant,
                        padelMeta: resolvedPadelMeta ?? padelMeta,
                        pairingId: pairingResult.pairingId,
                        pairingSlotId: pairingResult.slotId ?? undefined,
                        ticketTypeId: Number(target.id)
                    }
                });
                irParaPasso(2);
            });
            return;
        }
        // Permitir avançar mesmo que aparente 0€ — backend decide se é FREE/PAID.
        if (selectedQty <= 0) return;
        // Guardar info deste step no contexto (quantidades + total)
        atualizarDados({
            paymentScenario: "SINGLE",
            additional: {
                ...safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {},
                quantidades,
                total,
                checkoutUiVariant: variant
            }
        });
        irParaPasso(2);
    }
    if (!hasWaves) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-6 text-sm text-white/70",
            children: "A carregar bilhetes... Se isto persistir, volta atrás e tenta novamente."
        }, void 0, false, {
            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
            lineNumber: 388,
            columnNumber: 7
        }, this);
    }
    if (variant === "PADEL") {
        const baseWave = padelCandidateWave;
        const basePrice = baseWave?.price ?? 0;
        const hasPairSlotsAvailable = padelHasPairSlots;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-col gap-6 text-white",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "flex items-start justify-between gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] uppercase tracking-[0.18em] text-white/55",
                                    children: "Passo 1 de 3"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 402,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-2xl font-semibold leading-tight",
                                    children: "Escolhe como queres jogar"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 405,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-white/60 max-w-sm",
                                    children: "Padel: inscrição individual ou como dupla. Pagas já a tua parte ou a dupla completa."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 406,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 401,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: fecharCheckout,
                            className: "text-[11px] rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75 hover:text-white hover:border-white/40 transition-colors",
                            children: "Fechar"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 410,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 400,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-full w-1/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] animate-pulse"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                        lineNumber: 420,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 419,
                    columnNumber: 9
                }, this),
                padelCategoryOptions.length > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.55)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                            children: "Categoria"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 425,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-3 flex flex-wrap gap-2",
                            children: padelCategoryOptions.map((opt)=>{
                                const isSelected = opt.key === selectedPadelCategoryKey;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>{
                                        setSelectedPadelCategoryKey(opt.key);
                                        if (padelStockError) setPadelStockError(null);
                                    },
                                    className: `rounded-full border px-3 py-1.5 text-[12px] transition ${isSelected ? "border-[#6BFFFF]/70 bg-white/12 text-white shadow-[0_10px_30px_rgba(107,255,255,0.25)]" : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30"}`,
                                    children: opt.label
                                }, opt.key, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 430,
                                    columnNumber: 19
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 426,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 424,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-3 md:grid-cols-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>{
                                setPadelSelection("INDIVIDUAL");
                                setPadelJoinMode("LOOKING_FOR_PARTNER");
                                if (padelStockError) setPadelStockError(null);
                            },
                            disabled: !hasPairSlotsAvailable,
                            className: `rounded-2xl border px-4 py-4 text-left transition shadow-lg ${padelSelection === "INDIVIDUAL" ? "border-[#6BFFFF]/70 bg-white/12 shadow-[0_10px_40px_rgba(107,255,255,0.25)]" : "border-white/10 bg-white/[0.04] hover:border-white/25"} ${!hasPairSlotsAvailable ? "opacity-50 cursor-not-allowed" : ""}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm font-semibold",
                                    children: "Inscrição individual"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 466,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-white/65 mt-1",
                                    children: "1 lugar. Entrar em matchmaking."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 467,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-3 text-lg font-semibold",
                                    children: [
                                        basePrice.toFixed(2),
                                        " €"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 468,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-3 text-[11px] text-white/70",
                                    children: "Pagas só a tua parte e ficas em procura de parceiro."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 469,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 452,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>{
                                setPadelSelection("DUO_SPLIT");
                                setPadelJoinMode("INVITE_PARTNER");
                                if (padelStockError) setPadelStockError(null);
                            },
                            disabled: !hasPairSlotsAvailable,
                            className: `rounded-2xl border px-4 py-4 text-left transition shadow-lg ${padelSelection === "DUO_SPLIT" ? "border-[#6BFFFF]/70 bg-white/12 shadow-[0_10px_40px_rgba(107,255,255,0.25)]" : "border-white/10 bg-white/[0.04] hover:border-white/25"} ${!hasPairSlotsAvailable ? "opacity-50 cursor-not-allowed" : ""}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm font-semibold",
                                    children: "Dupla · já tenho parceiro"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 488,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-white/65 mt-1",
                                    children: "1 lugar pago. O parceiro paga o dele."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 489,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-3 text-lg font-semibold",
                                    children: [
                                        basePrice.toFixed(2),
                                        " €"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 490,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 474,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>{
                                setPadelSelection("DUO_FULL");
                                setPadelJoinMode("INVITE_PARTNER");
                                if (padelStockError) setPadelStockError(null);
                            },
                            disabled: !hasPairSlotsAvailable,
                            className: `rounded-2xl border px-4 py-4 text-left transition shadow-lg ${padelSelection === "DUO_FULL" ? "border-[#6BFFFF]/70 bg-white/12 shadow-[0_10px_40px_rgba(107,255,255,0.25)]" : "border-white/10 bg-white/[0.04] hover:border-white/25"} ${!hasPairSlotsAvailable ? "opacity-50 cursor-not-allowed" : ""}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm font-semibold",
                                    children: "Dupla · pagar os dois lugares"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 507,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-white/65 mt-1",
                                    children: "2 lugares pagos já garantidos."
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 508,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-3 text-lg font-semibold",
                                    children: [
                                        (basePrice * 2).toFixed(2),
                                        " €"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 509,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 493,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 451,
                    columnNumber: 9
                }, this),
                padelJoinMode === "INVITE_PARTNER" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.55)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] font-semibold text-white",
                            children: "Dados do parceiro (obrigatório)"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 515,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] text-white/60 mt-1",
                            children: "Adiciona o email, telefone ou @username para enviar o convite e prender o lugar dele."
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 516,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-3",
                            children: [
                                partnerSelected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-sm text-white",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-7 w-7 rounded-full bg-white/10 overflow-hidden border border-white/10",
                                            children: partnerSelected.avatarUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                src: partnerSelected.avatarUrl,
                                                alt: partnerSelected.username ?? partnerSelected.fullName ?? "user",
                                                className: "h-full w-full object-cover"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 524,
                                                columnNumber: 23
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-full w-full flex items-center justify-center text-[11px] text-white/70",
                                                children: (partnerSelected.username ?? partnerSelected.fullName ?? "?").slice(0, 2).toUpperCase()
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 530,
                                                columnNumber: 23
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                            lineNumber: 522,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-medium",
                                            children: partnerSelected.username ? `@${partnerSelected.username}` : partnerSelected.fullName ?? "Utilizador"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                            lineNumber: 535,
                                            columnNumber: 19
                                        }, this),
                                        partnerSelected.fullName && partnerSelected.username && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[11px] text-white/70",
                                            children: [
                                                "· ",
                                                partnerSelected.fullName
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                            lineNumber: 539,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>{
                                                setPartnerSelected(null);
                                                setPartnerContact("");
                                            },
                                            className: "ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[11px] text-white/80 hover:bg-white/20",
                                            children: "×"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                            lineNumber: 541,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 521,
                                    columnNumber: 17
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    value: partnerContact,
                                    onChange: (e)=>{
                                        setPartnerContact(e.target.value);
                                        setPartnerSelected(null);
                                        if (partnerError) setPartnerError(null);
                                    },
                                    placeholder: "Email / telefone / @username",
                                    className: `w-full rounded-xl border bg-white/5 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none ${partnerError ? "border-red-400/70 focus:border-red-300/90" : "border-white/15 focus:border-white/40"}`
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 553,
                                    columnNumber: 17
                                }, this),
                                partnerError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-2 text-[11px] text-red-300",
                                    children: partnerError
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 570,
                                    columnNumber: 17
                                }, this),
                                !partnerError && partnerLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-2 text-[11px] text-white/60",
                                    children: "A procurar utilizadores…"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 573,
                                    columnNumber: 17
                                }, this),
                                !partnerSelected && !partnerError && !partnerLoading && partnerResults.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/12 bg-black/70 shadow-[0_12px_30px_rgba(0,0,0,0.5)]",
                                    children: partnerResults.map((user)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>{
                                                const username = user.username ? `@${user.username}` : user.fullName ?? "";
                                                setPartnerContact(username);
                                                setPartnerSelected({
                                                    ...user,
                                                    label: username
                                                });
                                                setPartnerResults([]);
                                                setPartnerError(null);
                                            },
                                            className: "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "h-8 w-8 rounded-full bg-white/10 overflow-hidden border border-white/10",
                                                    children: user.avatarUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                        src: user.avatarUrl,
                                                        alt: user.username ?? user.fullName ?? "user",
                                                        className: "h-full w-full object-cover"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                        lineNumber: 595,
                                                        columnNumber: 27
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-full w-full flex items-center justify-center text-[11px] text-white/70",
                                                        children: (user.username ?? user.fullName ?? "?").slice(0, 2).toUpperCase()
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                        lineNumber: 597,
                                                        columnNumber: 27
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                    lineNumber: 593,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-col",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-sm text-white",
                                                            children: user.username ? `@${user.username}` : user.fullName ?? "Utilizador"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                            lineNumber: 603,
                                                            columnNumber: 25
                                                        }, this),
                                                        user.fullName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-[11px] text-white/60",
                                                            children: user.fullName
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                            lineNumber: 605,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                    lineNumber: 602,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, user.id, true, {
                                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                            lineNumber: 578,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                    lineNumber: 576,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 519,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 514,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between gap-3 border-t border-white/10 pt-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-[11px] text-white/70",
                            children: "Seleciona uma opção para avançar."
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 617,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: handleContinuar,
                            disabled: !canContinuePadel || !hasPairSlotsAvailable || !padelCategorySelected,
                            className: "rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-xs font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] hover:scale-[1.02] active:scale-95 transition-transform disabled:cursor-not-allowed disabled:opacity-50",
                            children: "Continuar"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                            lineNumber: 620,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 616,
                    columnNumber: 9
                }, this),
                padelStockError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[11px] text-amber-200",
                    children: padelStockError
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 630,
                    columnNumber: 11
                }, this),
                !padelStockError && !padelCategorySelected && padelCategoryRequired && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[11px] text-amber-200",
                    children: "Seleciona uma categoria para continuar."
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 633,
                    columnNumber: 11
                }, this),
                !padelStockError && !hasPairSlotsAvailable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[11px] text-amber-200",
                    children: "Sem vagas suficientes para criar uma dupla."
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 636,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
            lineNumber: 399,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-6 text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "flex items-start justify-between gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.18em] text-white/55",
                                children: "Passo 1 de 3"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                lineNumber: 647,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-2xl font-semibold leading-tight",
                                children: "Escolhe o teu bilhete"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                lineNumber: 650,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] text-white/60 max-w-xs",
                                children: "Seleciona a wave, ajusta quantidades e revê antes de pagar."
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                lineNumber: 653,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                        lineNumber: 646,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: fecharCheckout,
                        className: "text-[11px] rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75 hover:text-white hover:border-white/40 transition-colors",
                        children: "Fechar"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                        lineNumber: 657,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                lineNumber: 645,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-full w-1/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] animate-pulse"
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                    lineNumber: 668,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                lineNumber: 667,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: stableWaves.map((wave)=>{
                    const q = quantidades[wave.id] ?? 0;
                    const isOpen = aberto === wave.id;
                    const status = normalizeStatus(wave.status);
                    const isSoldOut = status === "sold_out" || status === "closed";
                    const maxForWave = getMaxForWave(wave.id);
                    const badge = status === "upcoming" ? "Em breve" : isSoldOut ? "Venda terminada" : "Disponível";
                    const badgeClass = isSoldOut ? "border-red-400/50 bg-red-500/20 text-red-50" : status === "upcoming" ? "border-amber-300/50 bg-amber-400/20 text-amber-50" : "border-emerald-300/50 bg-emerald-500/18 text-emerald-50";
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-2xl border border-white/12 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>toggleWave(wave.id),
                                className: "w-full flex items-center justify-between px-4 py-3",
                                disabled: isSoldOut,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-left",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm font-semibold",
                                                children: wave.name
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 704,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-white/50",
                                                children: typeof wave.price === "number" ? `${wave.price.toFixed(2)} €` : "Preço indisponível"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 705,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                        lineNumber: 703,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `rounded-full border px-2 py-0.5 text-[10px] text-white/80 ${isSoldOut ? "border-red-400/40 bg-red-500/10" : "border-emerald-300/30 bg-emerald-400/10"}`,
                                                children: isSoldOut ? "Esgotado" : "Disponível"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 713,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `flex h-7 w-7 items-center justify-center rounded-full border ${q > 0 ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100" : "border-white/20 bg-white/10 text-white/80"}`,
                                                children: q > 0 ? q : isOpen ? "−" : "+"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 722,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                        lineNumber: 712,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                lineNumber: 697,
                                columnNumber: 15
                            }, this),
                            isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-4 pb-4 flex flex-col gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-white/60",
                                        children: wave.description ?? "Sem descrição disponível."
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                        lineNumber: 737,
                                        columnNumber: 19
                                    }, this),
                                    isSoldOut && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70",
                                        children: "Venda terminada. Escolhe outra wave ou volta mais tarde."
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                        lineNumber: 742,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-2 py-1.5 shadow-md",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>handleDecrement(wave.id),
                                                className: "flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50",
                                                disabled: isSoldOut,
                                                children: "–"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 748,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "w-9 text-center text-sm font-semibold",
                                                children: q
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 757,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>handleIncrement(wave.id),
                                                className: "flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-100 disabled:opacity-50",
                                                disabled: isSoldOut || (quantidades[wave.id] ?? 0) >= maxForWave,
                                                children: "+"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                                lineNumber: 761,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                        lineNumber: 747,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                lineNumber: 736,
                                columnNumber: 17
                            }, this)
                        ]
                    }, wave.id, true, {
                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                        lineNumber: 692,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                lineNumber: 672,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-t border-white/10 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] text-white/70",
                        children: [
                            "Total:",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-semibold text-white text-base",
                                children: [
                                    total.toFixed(2),
                                    " €"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                                lineNumber: 783,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                        lineNumber: 781,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: total === 0,
                        onClick: handleContinuar,
                        className: "mt-3 sm:mt-0 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-xs font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-transform",
                        children: "Continuar para pagamento"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                        lineNumber: 787,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
                lineNumber: 780,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/checkout/Step1Bilhete.tsx",
        lineNumber: 643,
        columnNumber: 5
    }, this);
}
}),
"[project]/lib/phone.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Utils partilhados para normalizar/validar telefones de forma consistente
// Remove caracteres inválidos, permitindo apenas dígitos e um único "+" no início
__turbopack_context__.s([
    "isValidPhone",
    ()=>isValidPhone,
    "normalizePhone",
    ()=>normalizePhone,
    "sanitizePhone",
    ()=>sanitizePhone
]);
function sanitizePhone(input) {
    let cleaned = input.replace(/[^\d+]/g, "");
    if (cleaned.includes("+")) {
        const firstPlus = cleaned.indexOf("+");
        cleaned = "+" + cleaned.slice(firstPlus + 1).replace(/\+/g, "");
    }
    return cleaned;
}
function isValidPhone(input) {
    const value = sanitizePhone(input);
    if (!value) return false;
    return /^\+?\d{6,15}$/.test(value);
}
function normalizePhone(input) {
    return sanitizePhone(input);
}
}),
"[project]/lib/username.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "USERNAME_RULES_HINT",
    ()=>USERNAME_RULES_HINT,
    "sanitizeUsername",
    ()=>sanitizeUsername,
    "validateUsername",
    ()=>validateUsername
]);
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;
function sanitizeUsername(input) {
    const base = (input ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); // remove diacríticos
    const cleaned = base.replace(/[^A-Za-z0-9._]/g, "");
    const trimmed = cleaned.replace(/^\.+/, "").replace(/\.+$/, "");
    const collapsedDots = trimmed.replace(/\.{2,}/g, ".");
    return collapsedDots.toLowerCase().slice(0, 30);
}
function validateUsername(raw) {
    const normalized = sanitizeUsername(raw);
    if (!normalized || normalized.length < 3 || normalized.length > 30) {
        return {
            valid: false,
            error: "Escolhe um username entre 3 e 30 caracteres (letras, números, _ ou .)."
        };
    }
    if (!USERNAME_REGEX.test(normalized)) {
        return {
            valid: false,
            error: "O username só pode ter letras, números, _ e . (sem espaços ou acentos)."
        };
    }
    if (normalized.includes("..")) {
        return {
            valid: false,
            error: "O username não pode ter '..' seguido."
        };
    }
    return {
        valid: true,
        normalized
    };
}
const USERNAME_RULES_HINT = "3-30 caracteres, letras ou números, opcionalmente _ ou ., sem espaços ou acentos.";
}),
"[project]/app/components/checkout/Step2Pagamento.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Step2Pagamento
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$react$2d$stripe$2d$js$2f$dist$2f$react$2d$stripe$2e$esm$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stripe/react-stripe-js/dist/react-stripe.esm.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$stripe$2d$js$2f$lib$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@stripe/stripe-js/lib/index.mjs [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$stripe$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stripe/stripe-js/dist/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseBrowser.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$phone$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/phone.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/username.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
function isValidEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
function formatMoney(cents, currency = "EUR") {
    return new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(cents / 100);
}
function buildClientFingerprint(input) {
    try {
        return JSON.stringify(input);
    } catch  {
        // Fallback muito raro (ex.: objeto circular) — usamos um valor que força refresh.
        return `fp_${Date.now()}`;
    }
}
const scenarioCopy = {
    GROUP_SPLIT: "Estás a pagar apenas a tua parte desta dupla.",
    GROUP_FULL: "Estás a comprar 2 lugares (tu + parceiro).",
    RESALE: "Estás a comprar um bilhete em revenda.",
    FREE_CHECKOUT: "Evento gratuito — só para utilizadores com conta e username."
};
const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";
function Step2Pagamento() {
    const { dados, irParaPasso, atualizarDados, breakdown, setBreakdown } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    const [clientSecret, setClientSecret] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [serverAmount, setServerAmount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // 🔐 Auth state
    const [authChecked, setAuthChecked] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [userId, setUserId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [authChecking, setAuthChecking] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    // Preferimos convidado por defeito para reduzir fricção
    const [purchaseMode, setPurchaseMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("guest");
    const [authInfo, setAuthInfo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [guestErrors, setGuestErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const persistedIdemKeyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // 👤 Guest form state
    const [guestName, setGuestName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [guestEmail, setGuestEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [guestEmailConfirm, setGuestEmailConfirm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [guestPhone, setGuestPhone] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [guestSubmitVersion, setGuestSubmitVersion] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [promoInput, setPromoInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [promoCode, setPromoCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [appliedDiscount, setAppliedDiscount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [promoWarning, setPromoWarning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [appliedPromoLabel, setAppliedPromoLabel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const lastIntentKeyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const inFlightIntentRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const ensuredIdemKeyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const lastClearedFingerprintRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const idempotencyMismatchCountRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const loadErrorCountRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const [cachedIntent, setCachedIntent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const safeDados = dados && typeof dados === "object" ? dados : null;
    const scenario = safeDados?.paymentScenario ?? cachedIntent?.paymentScenario ?? null;
    const isFreeScenario = scenario === "FREE_CHECKOUT";
    const needsStripe = !isFreeScenario;
    const pairingId = safeDados?.additional && typeof safeDados.additional === "object" ? safeDados.additional.pairingId : undefined;
    const pairingSlotId = safeDados?.additional && typeof safeDados.additional === "object" ? safeDados.additional.pairingSlotId : undefined;
    const pairingTicketTypeId = safeDados?.additional && typeof safeDados.additional === "object" ? safeDados.additional.ticketTypeId : undefined;
    const inviteToken = safeDados?.additional && typeof safeDados.additional === "object" ? safeDados.additional.inviteToken : undefined;
    const additionalForRules = safeDados?.additional && typeof safeDados.additional === "object" ? safeDados.additional : {};
    // Regras de acesso ao checkout:
    // - FREE_CHECKOUT: sempre com conta
    // - GROUP_SPLIT: por defeito exige conta (capitão a pagar a sua parte)
    // - Podemos forçar via additional.requiresAuth (SSOT no futuro)
    const requiresAuth = Boolean(additionalForRules?.requiresAuth) || isFreeScenario || scenario === "GROUP_SPLIT";
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!safeDados) return;
        if (ensuredIdemKeyRef.current) return;
        const additional = safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {};
        const existing = typeof additional.idempotencyKey === "string" && additional.idempotencyKey.trim() ? additional.idempotencyKey.trim() : null;
        if (!existing) {
            ensuredIdemKeyRef.current = true;
            try {
                atualizarDados({
                    additional: {
                        ...safeDados?.additional ?? {},
                        idempotencyKey: crypto.randomUUID()
                    }
                });
            } catch  {
            // Se por algum motivo falhar (ambiente sem crypto), não bloqueamos o checkout
            }
            return;
        }
        ensuredIdemKeyRef.current = true;
    }, [
        safeDados,
        atualizarDados
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!promoCode.trim()) {
            setAppliedDiscount(0);
        }
    }, [
        promoCode
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (requiresAuth && purchaseMode !== "auth") {
            setPurchaseMode("auth");
            setClientSecret(null);
            setServerAmount(null);
        }
    }, [
        requiresAuth,
        purchaseMode
    ]);
    const stripePromise = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        // FREE_CHECKOUT não precisa de Stripe no cliente.
        if (!needsStripe) return null;
        const key = ("TURBOPACK compile-time value", "pk_test_51STpCU8Z8GNlpSy2RkmY6GUE2PHYIKR8vThPIESLlYcG0rzw0xRZ8Aw6wqYQRarkUt5MzrLFJDUhRqpIxOsaJVTE006I15uxKu");
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$stripe$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["loadStripe"])(key);
    }, [
        needsStripe
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (needsStripe && !stripePromise) {
            setError("Configuração de pagamentos indisponível. Tenta novamente mais tarde.");
            setLoading(false);
        }
    }, [
        stripePromise,
        needsStripe
    ]);
    // Primeiro: verificar se há sessão Supabase no browser e ficar a escutar mudanças de auth
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let cancelled = false;
        async function checkAuthOnce() {
            try {
                setAuthChecking(true);
                const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.getUser();
                if (cancelled) return;
                if (error || !data?.user) {
                    setUserId(null);
                    if (error) {
                        setAuthInfo("Sessão não encontrada. Inicia sessão ou continua como convidado.");
                    }
                } else {
                    setUserId(data.user.id);
                    setAuthInfo(null);
                }
            } catch (err) {
                console.error("[Step2Pagamento] Erro ao verificar auth inicial:", err);
                if (!cancelled) {
                    setUserId(null);
                    setAuthInfo("Sessão não encontrada. Inicia sessão ou continua como convidado.");
                }
            } finally{
                if (!cancelled) {
                    setAuthChecked(true);
                    setAuthChecking(false);
                }
            }
        }
        checkAuthOnce();
        const { data: { subscription } } = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.onAuthStateChange((_event, session)=>{
            if (cancelled) return;
            if (session?.user) {
                setUserId(session.user.id);
                setAuthChecked(true);
                setAuthChecking(false);
                setAuthInfo(null);
            } else {
                setUserId(null);
                setAuthChecked(true);
                setAuthChecking(false);
                setAuthInfo("Sessão não encontrada. Inicia sessão ou continua como convidado.");
            }
        });
        return ()=>{
            cancelled = true;
            subscription.unsubscribe();
        };
    }, []);
    // Se vierem dados pré-preenchidos (ex.: voltar atrás), sincronizamos com o estado local do guest
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const additional = safeDados?.additional && typeof safeDados.additional === "object" ? safeDados.additional : {};
        if (typeof additional.guestName === "string") {
            setGuestName(additional.guestName);
        }
        if (typeof additional.guestEmail === "string") {
            setGuestEmail(additional.guestEmail);
        }
        if (typeof additional?.guestEmailConfirm === "string") {
            setGuestEmailConfirm(additional.guestEmailConfirm);
        }
        if (typeof additional.guestPhone === "string") {
            setGuestPhone(additional.guestPhone);
        }
    }, [
        safeDados
    ]);
    const payload = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!safeDados) return null;
        const waves = Array.isArray(safeDados.waves) ? safeDados.waves : [];
        const additional = safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {};
        const quantidades = additional.quantidades ?? {};
        if (!safeDados.slug || waves.length === 0) return null;
        const items = waves.map((w)=>{
            const qty = quantidades[w.id] ?? 0;
            if (!qty || qty <= 0) return null;
            const ticketId = Number(w.id);
            if (!Number.isFinite(ticketId)) return null;
            return {
                ticketId,
                quantity: qty
            };
        }).filter(Boolean).sort((a, b)=>a.ticketId - b.ticketId);
        if (items.length === 0) return null;
        const totalFromStep1 = typeof additional.total === "number" ? additional.total : null;
        // IdempotencyKey estável: reutiliza a existente; se não houver, gera apenas uma vez
        let idemKey = safeDados?.additional?.idempotencyKey;
        if (!idemKey || !idemKey.trim()) {
            if (!persistedIdemKeyRef.current) {
                try {
                    persistedIdemKeyRef.current = crypto.randomUUID();
                } catch  {
                    persistedIdemKeyRef.current = `idem-${Date.now()}`;
                }
            }
            idemKey = persistedIdemKeyRef.current ?? undefined;
        } else {
            persistedIdemKeyRef.current = idemKey;
        }
        const purchaseId = undefined;
        return {
            slug: safeDados.slug,
            items,
            total: totalFromStep1,
            promoCode: promoCode.trim() || undefined,
            paymentScenario: safeDados.paymentScenario ?? undefined,
            requiresAuth,
            idempotencyKey: idemKey,
            purchaseId: purchaseId || undefined,
            pairingId: typeof pairingId === "number" ? pairingId : undefined,
            slotId: typeof pairingSlotId === "number" ? pairingSlotId : undefined,
            ticketTypeId: typeof pairingTicketTypeId === "number" ? pairingTicketTypeId : undefined,
            eventId: safeDados.eventId ? Number(safeDados.eventId) : undefined,
            inviteToken: typeof inviteToken === "string" && inviteToken.trim() ? inviteToken.trim() : undefined
        };
    }, [
        safeDados,
        promoCode,
        requiresAuth
    ]);
    // Garante idempotencyKey persistida no contexto para estabilizar intentKey e evitar re-renders infinitos
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!safeDados) return;
        const additionalObj = safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {};
        const existing = typeof additionalObj.idempotencyKey === "string" && additionalObj.idempotencyKey.trim() ? additionalObj.idempotencyKey.trim() : null;
        if (existing) {
            persistedIdemKeyRef.current = existing;
            return;
        }
        let newKey = persistedIdemKeyRef.current;
        if (!newKey) {
            try {
                newKey = crypto.randomUUID();
            } catch  {
                newKey = `idem-${Date.now()}`;
            }
            persistedIdemKeyRef.current = newKey;
        }
        atualizarDados({
            additional: {
                ...safeDados.additional,
                idempotencyKey: newKey
            }
        });
    }, [
        safeDados,
        atualizarDados
    ]);
    const checkUsernameAvailability1 = async (value)=>{
        const cleaned = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sanitizeUsername"])(value);
        const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$username$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateUsername"])(cleaned);
        if (!validation.valid) {
            setError(validation.error);
            return {
                ok: false,
                username: cleaned
            };
        }
        try {
            const res = await fetch(`/api/username/check?username=${encodeURIComponent(cleaned)}`);
            const json = await res.json().catch(()=>null);
            if (!res.ok || json?.available === false) {
                setError("Esse @ já está a ser usado.");
                return {
                    ok: false,
                    username: cleaned
                };
            }
            return {
                ok: true,
                username: validation.normalized
            };
        } catch (err) {
            console.error("[Step2Pagamento] erro a verificar username", err);
            setError("Não foi possível verificar o username. Tenta novamente.");
            return {
                ok: false,
                username: cleaned
            };
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        // Se não houver dados de checkout, mandamos de volta
        if (!payload) {
            irParaPasso(1);
            return;
        }
        if (needsStripe && !stripePromise) return;
        // Enquanto não sabemos se está logado, não fazemos nada
        if (!authChecked) return;
        const isGuestFlow = purchaseMode === "guest";
        const hasGuestSubmission = guestSubmitVersion > 0;
        const guestNameClean = guestName.trim();
        const guestEmailClean = guestEmail.trim();
        const guestPhoneClean = guestPhone.trim();
        const guestReady = isGuestFlow && hasGuestSubmission && guestNameClean !== "" && guestEmailClean !== "";
        // Se não está logado e ainda não escolheu convidado, mostramos UI e não chamamos a API
        if (!userId && !guestReady) {
            setLoading(false);
            setClientSecret(null);
            setServerAmount(null);
            return;
        }
        const guestPayload = guestReady ? {
            name: guestNameClean,
            email: guestEmailClean,
            phone: guestPhoneClean || undefined
        } : null;
        const clientFingerprint = buildClientFingerprint({
            slug: payload.slug,
            items: payload.items,
            total: payload.total ?? null,
            promoCode: payload.promoCode ?? null,
            paymentScenario: payload.paymentScenario ?? null,
            requiresAuth,
            mode: purchaseMode,
            userId: userId ?? null,
            guest: guestPayload ? {
                name: guestPayload.name,
                email: guestPayload.email,
                phone: guestPayload.phone ?? null
            } : null
        });
        const additionalObj = safeDados?.additional && typeof safeDados.additional === "object" ? safeDados.additional : {};
        const existingClientFingerprint = typeof additionalObj.clientFingerprint === "string" ? String(additionalObj.clientFingerprint) : null;
        const currentIdempotencyKey = safeDados?.additional?.idempotencyKey ?? payload?.idempotencyKey ?? null;
        const existingIntentFingerprint = typeof additionalObj.intentFingerprint === "string" ? String(additionalObj.intentFingerprint) : null;
        const hasExistingPurchaseState = Boolean(additionalObj.purchaseId || additionalObj.paymentIntentId || additionalObj.freeCheckout);
        // Se o utilizador alterou o checkout (items/promo/guest/mode/etc.) mas ainda temos um purchaseId antigo,
        // limpamos o estado para não reutilizar o PaymentIntent errado (caso clássico: aplicar/remover promo e não recalcular).
        if (hasExistingPurchaseState && existingClientFingerprint && existingClientFingerprint !== clientFingerprint && lastClearedFingerprintRef.current !== clientFingerprint) {
            lastClearedFingerprintRef.current = clientFingerprint;
            // Limpeza local imediata para evitar UI/states inconsistentes
            setCachedIntent(null);
            setClientSecret(null);
            setServerAmount(null);
            setBreakdown(null);
            lastIntentKeyRef.current = null;
            inFlightIntentRef.current = null;
            let nextIdemKey;
            try {
                nextIdemKey = crypto.randomUUID();
            } catch  {
                nextIdemKey = undefined;
            }
            atualizarDados({
                additional: {
                    ...safeDados?.additional ?? {},
                    purchaseId: null,
                    paymentIntentId: undefined,
                    freeCheckout: undefined,
                    appliedPromoLabel: undefined,
                    // clientFingerprint é só para o FE detetar mudanças
                    clientFingerprint,
                    // intentFingerprint é do BE (hash). Ao mudar seleção, limpamos.
                    intentFingerprint: undefined,
                    idempotencyKey: nextIdemKey ?? additionalObj.idempotencyKey
                }
            });
            setLoading(false);
            return;
        }
        // Backfill: se já existe purchaseId mas ainda não guardámos fingerprint, guardamos para futuras comparações.
        if (hasExistingPurchaseState && !existingClientFingerprint) {
            atualizarDados({
                additional: {
                    ...safeDados?.additional ?? {},
                    clientFingerprint
                }
            });
        }
        // Chave estável para não recriar PaymentIntent sem necessidade
        const intentKey = JSON.stringify({
            payload,
            guest: guestPayload,
            userId: userId ?? "guest",
            mode: purchaseMode,
            scenario: safeDados?.paymentScenario ?? null,
            clientFingerprint,
            idempotencyKey: currentIdempotencyKey,
            purchaseId: payload?.purchaseId ?? safeDados?.additional?.purchaseId ?? null
        });
        // Se já temos um intent em cache com a mesma key, reaproveitamos
        if (cachedIntent?.key === intentKey) {
            setClientSecret(cachedIntent.clientSecret);
            setServerAmount(cachedIntent.amount);
            setBreakdown(cachedIntent.breakdown);
            setAppliedDiscount(cachedIntent.discount);
            setAppliedPromoLabel(cachedIntent.promoLabel ?? null);
            lastIntentKeyRef.current = intentKey;
            setLoading(false);
            if (cachedIntent.freeCheckout) {
                irParaPasso(3);
                return;
            }
            return;
        }
        // Se já temos clientSecret para o mesmo payload, não refazemos
        if (clientSecret && lastIntentKeyRef.current === intentKey) {
            setLoading(false);
            return;
        }
        // Evita requests paralelos com o mesmo payload; se detectarmos que estamos presos
        // (ex.: Strict Mode cancela a primeira run e deixa loading a true), limpamos o ref
        // para voltar a tentar.
        if (inFlightIntentRef.current === intentKey) {
            const stuck = loading && !clientSecret && lastIntentKeyRef.current !== intentKey;
            if (!stuck) {
                return;
            }
            inFlightIntentRef.current = null;
        }
        let cancelled = false;
        async function createIntent() {
            try {
                inFlightIntentRef.current = intentKey;
                setLoading(true);
                setError(null);
                setBreakdown(null);
                console.log("[Step2Pagamento] A enviar payload para /api/payments/intent:", payload);
                const idem = safeDados?.additional?.idempotencyKey ?? payload?.idempotencyKey ?? null;
                let attempt = 0;
                // Não enviamos purchaseId; o backend calcula anchors determinísticas. idempotencyKey segue para evitar PI terminal.
                let currentPayload = {
                    ...payload
                };
                delete currentPayload.purchaseId;
                let currentIntentFingerprint = undefined;
                let res = null;
                let data = null;
                let handled409 = false;
                while(attempt < 2){
                    res = await fetch("/api/payments/intent", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            ...currentPayload,
                            guest: guestPayload ?? undefined,
                            requiresAuth,
                            purchaseId: null,
                            idempotencyKey: idem,
                            intentFingerprint: currentIntentFingerprint ?? undefined
                        })
                    });
                    data = await res.json().catch(()=>null);
                    if (res.status === 409) {
                        handled409 = true;
                        attempt += 1;
                        // Reset total: limpar caches e fazer um retry sem anchors próprias.
                        currentPayload = {
                            ...payload
                        };
                        delete currentPayload.purchaseId;
                        currentIntentFingerprint = undefined;
                        if (!cancelled) {
                            setCachedIntent(null);
                            setClientSecret(null);
                            setServerAmount(null);
                            setBreakdown(null);
                            lastIntentKeyRef.current = null;
                            inFlightIntentRef.current = null;
                            try {
                                atualizarDados({
                                    additional: {
                                        ...safeDados?.additional ?? {},
                                        purchaseId: null,
                                        paymentIntentId: undefined,
                                        freeCheckout: undefined,
                                        appliedPromoLabel: undefined,
                                        clientFingerprint,
                                        intentFingerprint: undefined,
                                        idempotencyKey: undefined
                                    }
                                });
                            } catch  {}
                        }
                        continue;
                    }
                    break;
                }
                if (!data || typeof data !== "object") {
                    if (!cancelled) {
                        setBreakdown(null);
                        setError("Resposta inválida do servidor. Tenta novamente.");
                    }
                    return;
                }
                console.log("[Step2Pagamento] Resposta de /api/payments/intent:", {
                    status: res.status,
                    ok: res.ok,
                    data
                });
                const respCode = typeof data?.code === "string" ? data.code : null;
                // 409 ➜ idempotencyKey reutilizada com payload diferente (proteção contra intents errados/duplicados)
                if (res.status === 409) {
                    if (!cancelled) {
                        // Reset total para forçar recalcular (idempotencyKey + purchaseId + PI state)
                        setCachedIntent(null);
                        setClientSecret(null);
                        setServerAmount(null);
                        setBreakdown(null);
                        lastIntentKeyRef.current = null;
                        inFlightIntentRef.current = null;
                        let nextIdemKey;
                        try {
                            nextIdemKey = crypto.randomUUID();
                        } catch  {
                            nextIdemKey = undefined;
                        }
                        try {
                            atualizarDados({
                                additional: {
                                    ...safeDados?.additional ?? {},
                                    purchaseId: null,
                                    paymentIntentId: undefined,
                                    freeCheckout: undefined,
                                    appliedPromoLabel: undefined,
                                    clientFingerprint,
                                    intentFingerprint: undefined,
                                    idempotencyKey: nextIdemKey
                                }
                            });
                        } catch  {}
                        // Força novo ciclo de preparação (especialmente útil em guest flow)
                        setGuestSubmitVersion((v)=>v + 1);
                        setPromoWarning(typeof data?.error === "string" ? data.error : "O teu checkout mudou e estamos a recalcular o pagamento…");
                        setError(null);
                    }
                    return;
                }
                // Se a API disser 401 ➜ sessão ausente/expirada OU cenário que exige auth
                if (res.status === 401) {
                    const mustAuth = requiresAuth || respCode === "AUTH_REQUIRED_FOR_GROUP_SPLIT" || respCode === "AUTH_REQUIRED";
                    if (!cancelled) {
                        // Garantimos estado limpo para permitir retry correto
                        setClientSecret(null);
                        setServerAmount(null);
                        setBreakdown(null);
                        setCachedIntent(null);
                    }
                    if (mustAuth) {
                        if (!cancelled) {
                            setPurchaseMode("auth");
                            setGuestSubmitVersion(0);
                            setGuestErrors({});
                            setError(null);
                            const freeCopy = respCode === "AUTH_REQUIRED_FOR_GROUP_SPLIT" ? "Para pagar apenas a tua parte tens de iniciar sessão." : isFreeScenario ? "Checkouts gratuitos exigem conta com username. Cria conta ou entra para continuar." : "Este tipo de checkout requer sessão iniciada.";
                            setAuthInfo(freeCopy);
                        }
                        return;
                    }
                    // Guest permitido, mas algo correu mal (ex.: backend rejeitou por sessão)
                    if (!cancelled) {
                        setError(typeof data?.error === "string" ? data.error : "Sessão expirada. Tenta novamente.");
                    }
                    return;
                }
                // 403 ➜ utilizador autenticado mas falta username (free checkout)
                if (res.status === 403 && respCode === "USERNAME_REQUIRED") {
                    if (!cancelled) {
                        setPurchaseMode("auth");
                        setGuestSubmitVersion(0);
                        setGuestErrors({});
                        setError(null);
                        setAuthInfo("Define um username na tua conta para concluir este checkout gratuito.");
                    }
                    return;
                }
                if (!res.ok || !data?.ok) {
                    setBreakdown(null);
                    const respCode = typeof data?.code === "string" ? data.code : null;
                    const retryable = typeof data?.retryable === "boolean" ? data.retryable : null;
                    const nextAction = typeof data?.nextAction === "string" && data.nextAction ? data.nextAction : null;
                    if (respCode === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
                        if (!cancelled) {
                            // Limita a 1 retentativa local para evitar loops de 409
                            if (idempotencyMismatchCountRef.current >= 1) {
                                setError(typeof data?.error === "string" ? data.error : "O checkout mudou noutro separador. Volta ao passo anterior ou recarrega a página e tenta de novo.");
                                setSubmitting(false);
                                setLoading(false);
                                return;
                            }
                            idempotencyMismatchCountRef.current += 1;
                            // Limpa estado local para forçar novo intent (sem reusar idempotency antiga)
                            setClientSecret(null);
                            setServerAmount(null);
                            setBreakdown(null);
                            setCachedIntent(null);
                            lastIntentKeyRef.current = null;
                            inFlightIntentRef.current = null;
                            try {
                                atualizarDados({
                                    additional: {
                                        ...safeDados?.additional ?? {},
                                        purchaseId: null,
                                        paymentIntentId: undefined,
                                        idempotencyKey: undefined,
                                        intentFingerprint: undefined,
                                        clientFingerprint,
                                        freeCheckout: undefined,
                                        appliedPromoLabel: undefined
                                    }
                                });
                            } catch  {}
                            setError(typeof data?.error === "string" ? data.error : "O checkout foi aberto noutro separador. Recriámos o pagamento; volta a clicar em Pagar.");
                        // Não re-submete automaticamente; utilizador volta a clicar
                        }
                        return;
                    }
                    if (respCode === "USERNAME_REQUIRED_FOR_FREE") {
                        if (!cancelled) {
                            setError("Este evento gratuito requer sessão com username definido.");
                            setPurchaseMode("auth");
                            setAuthInfo("Inicia sessão e define um username para concluir a inscrição gratuita.");
                        }
                        return;
                    }
                    if (respCode === "INVITE_REQUIRED") {
                        if (!cancelled) {
                            setError("Este evento é apenas por convite.");
                            const inviteCopy = userId ? "O teu acesso não está na lista. Confirma o email/username convidado." : "Inicia sessão com a conta convidada ou usa o email do convite.";
                            setAuthInfo(inviteCopy);
                        }
                        return;
                    }
                    const msg = respCode === "PRICE_CHANGED" ? "Os preços foram atualizados. Revê a seleção e tenta novamente." : respCode === "INSUFFICIENT_STOCK" ? "Stock insuficiente para um dos bilhetes." : typeof data?.error === "string" ? data.error : "Não foi possível preparar o pagamento.";
                    if (respCode === "ORGANIZER_STRIPE_NOT_CONNECTED") {
                        if (!cancelled) {
                            setError(data?.message || "Pagamentos desativados para este evento enquanto o organizador não ligar a Stripe.");
                            setAuthInfo("Liga a Stripe em Finanças & Payouts para ativares pagamentos.");
                        }
                        return;
                    }
                    const promoFail = payload?.promoCode && typeof data?.error === "string" && data.error.toLowerCase().includes("código");
                    if (promoFail && !cancelled) {
                        setPromoWarning("Código não aplicado. Continuas sem desconto.");
                        setPromoCode("");
                        setAppliedDiscount(0);
                        setAppliedPromoLabel(null);
                        setError(null);
                        setBreakdown(null);
                        return;
                    }
                    if (!cancelled) {
                        setError(respCode === "PRICE_CHANGED" ? "Os preços mudaram. Volta ao passo anterior e revê a seleção." : respCode === "INSUFFICIENT_STOCK" ? "Stock insuficiente. Remove itens esgotados e tenta novamente." : nextAction === "PAY_NOW" && retryable ? "Precisamos de novo pagamento para continuar." : msg);
                        if (respCode === "PRICE_CHANGED" || respCode === "INSUFFICIENT_STOCK") {
                            setPromoWarning(null);
                            setBreakdown(null);
                            setClientSecret(null);
                            setServerAmount(null);
                        }
                    }
                    return;
                }
                if (!cancelled) {
                    const paymentScenarioResponse = typeof data?.paymentScenario === "string" ? data.paymentScenario : safeDados?.paymentScenario ?? null;
                    const purchaseIdFromServer = typeof data?.purchaseId === "string" ? data.purchaseId : undefined;
                    const responseIntentFingerprint = typeof data?.intentFingerprint === "string" ? data.intentFingerprint : null;
                    const responseIdemKey = typeof data?.idempotencyKey === "string" && data.idempotencyKey.trim() ? data.idempotencyKey.trim() : null;
                    const effectiveIntentFingerprint = responseIntentFingerprint ?? existingIntentFingerprint ?? undefined;
                    // Só fazemos backfill da idempotencyKey se por algum motivo ainda não existir localmente.
                    const localIdem = typeof safeDados?.additional?.idempotencyKey === "string" && String((safeDados?.additional).idempotencyKey).trim() ? String((safeDados?.additional).idempotencyKey).trim() : null;
                    const effectiveIdemKey = localIdem ?? responseIdemKey;
                    const promoLabel = promoCode?.trim() ? promoCode.trim() : data.discountCents && data.discountCents > 0 ? "Promo automática" : null;
                    const isAutoAppliedPromo = !promoCode?.trim() && Boolean(promoLabel);
                    const breakdownFromResponse = data.breakdown && typeof data.breakdown === "object" ? data.breakdown : null;
                    const discountCentsNumber = typeof data.discountCents === "number" ? data.discountCents : typeof breakdownFromResponse?.discountCents === "number" ? breakdownFromResponse.discountCents : 0;
                    const subtotalCentsNumber = typeof breakdownFromResponse?.subtotalCents === "number" ? breakdownFromResponse.subtotalCents : null;
                    const platformFeeCentsNumber = typeof breakdownFromResponse?.platformFeeCents === "number" ? breakdownFromResponse.platformFeeCents : null;
                    const platformFeeCombinedCentsNumber = typeof breakdownFromResponse?.platformFeeCombinedCents === "number" ? breakdownFromResponse.platformFeeCombinedCents : platformFeeCentsNumber;
                    const platformFeeOryaCentsNumber = typeof breakdownFromResponse?.platformFeeOryaCents === "number" ? breakdownFromResponse.platformFeeOryaCents : platformFeeCentsNumber;
                    const stripeFeeEstimateCentsNumber = typeof breakdownFromResponse?.stripeFeeEstimateCents === "number" ? breakdownFromResponse.stripeFeeEstimateCents : null;
                    const totalCentsNumber = typeof breakdownFromResponse?.totalCents === "number" ? breakdownFromResponse.totalCents : typeof data.amount === "number" ? data.amount : null;
                    const currencyFromResponse = typeof breakdownFromResponse?.currency === "string" ? breakdownFromResponse.currency : undefined;
                    const statusFromResponse = typeof data?.status === "string" ? data.status.toUpperCase() : null;
                    const nextActionFromResponse = typeof data?.nextAction === "string" ? data.nextAction : null;
                    const paymentIntentIdFromResponse = typeof data?.paymentIntentId === "string" ? data.paymentIntentId : null;
                    if (statusFromResponse === "FAILED") {
                        setClientSecret(null);
                        setServerAmount(null);
                        setBreakdown(null);
                        setError(typeof data?.error === "string" ? data.error : "Pagamento falhou.");
                        return;
                    }
                    if (data.freeCheckout || data.isFreeCheckout || statusFromResponse === "PAID") {
                        const totalCents = totalCentsNumber ?? 0;
                        setBreakdown(breakdownFromResponse);
                        setAppliedDiscount(discountCentsNumber > 0 ? discountCentsNumber / 100 : 0);
                        setAppliedPromoLabel(promoLabel);
                        setClientSecret(null);
                        setServerAmount(0);
                        atualizarDados({
                            additional: {
                                ...safeDados?.additional ?? {},
                                paymentIntentId: paymentIntentIdFromResponse ?? FREE_PLACEHOLDER_INTENT_ID,
                                purchaseId: purchaseIdFromServer,
                                subtotalCents: subtotalCentsNumber ?? undefined,
                                discountCents: discountCentsNumber ?? undefined,
                                platformFeeCents: platformFeeCombinedCentsNumber ?? undefined,
                                platformFeeOryaCents: platformFeeOryaCentsNumber ?? undefined,
                                stripeFeeEstimateCents: stripeFeeEstimateCentsNumber ?? undefined,
                                totalCents: totalCents,
                                currency: currencyFromResponse ?? undefined,
                                total: totalCents / 100,
                                freeCheckout: true,
                                clientFingerprint,
                                intentFingerprint: effectiveIntentFingerprint,
                                idempotencyKey: effectiveIdemKey ?? undefined,
                                promoCode: payload?.promoCode,
                                promoCodeRaw: payload?.promoCode,
                                appliedPromoLabel: promoLabel ?? undefined,
                                paymentScenario: paymentScenarioResponse ?? undefined
                            }
                        });
                        lastIntentKeyRef.current = intentKey;
                        irParaPasso(3);
                        return;
                    }
                    setClientSecret(data.clientSecret);
                    setServerAmount(typeof data.amount === "number" ? data.amount : null);
                    setBreakdown(breakdownFromResponse);
                    setAppliedDiscount(discountCentsNumber > 0 ? discountCentsNumber / 100 : 0);
                    setAppliedPromoLabel(promoLabel);
                    atualizarDados({
                        paymentScenario: paymentScenarioResponse ?? undefined,
                        additional: {
                            ...safeDados?.additional ?? {},
                            clientFingerprint,
                            intentFingerprint: effectiveIntentFingerprint,
                            idempotencyKey: effectiveIdemKey ?? undefined,
                            purchaseId: purchaseIdFromServer ?? safeDados?.additional?.purchaseId ?? payload?.purchaseId,
                            paymentIntentId: paymentIntentIdFromResponse ?? safeDados?.additional?.paymentIntentId,
                            subtotalCents: subtotalCentsNumber ?? undefined,
                            discountCents: discountCentsNumber ?? undefined,
                            platformFeeCents: platformFeeCombinedCentsNumber ?? undefined,
                            platformFeeOryaCents: platformFeeOryaCentsNumber ?? undefined,
                            stripeFeeEstimateCents: stripeFeeEstimateCentsNumber ?? undefined,
                            totalCents: totalCentsNumber ?? undefined,
                            currency: currencyFromResponse ?? undefined,
                            promoCode: payload?.promoCode,
                            promoCodeRaw: payload?.promoCode,
                            appliedPromoLabel: promoLabel ?? undefined
                        }
                    });
                    lastIntentKeyRef.current = intentKey;
                    setCachedIntent({
                        key: intentKey,
                        clientSecret: data.clientSecret,
                        amount: typeof data.amount === "number" ? data.amount : null,
                        breakdown: breakdownFromResponse,
                        discount: discountCentsNumber > 0 ? discountCentsNumber / 100 : 0,
                        freeCheckout: false,
                        paymentScenario: paymentScenarioResponse,
                        promoLabel,
                        autoAppliedPromo: isAutoAppliedPromo,
                        purchaseId: purchaseIdFromServer ?? null
                    });
                }
            } catch (err) {
                console.error("Erro ao criar PaymentIntent:", err);
                if (!cancelled) {
                    setError("Erro inesperado ao preparar o pagamento.");
                }
            } finally{
                if (!cancelled) setLoading(false);
                if (inFlightIntentRef.current === intentKey) {
                    inFlightIntentRef.current = null;
                }
            }
        }
        createIntent();
        return ()=>{
            cancelled = true;
            inFlightIntentRef.current = null;
        };
    }, [
        payload,
        irParaPasso,
        authChecked,
        userId,
        stripePromise,
        purchaseMode,
        guestSubmitVersion,
        cachedIntent
    ]);
    if (!safeDados) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-6 text-sm text-white/70",
            children: "Ocorreu um problema com os dados do checkout. Volta atrás e tenta de novo."
        }, void 0, false, {
            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
            lineNumber: 1142,
            columnNumber: 7
        }, this);
    }
    const additional = safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {};
    const totalFromContext = typeof additional.total === "number" ? additional.total : null;
    const breakdownTotal = breakdown && typeof breakdown.totalCents === "number" ? breakdown.totalCents / 100 : null;
    const total = breakdownTotal !== null ? breakdownTotal : totalFromContext !== null ? totalFromContext : serverAmount !== null ? serverAmount / 100 : null;
    const appearance = {
        theme: "night",
        variables: {
            colorPrimary: "#6BFFFF",
            colorBackground: "#0B0F18",
            colorText: "#F7F9FF",
            colorDanger: "#FF5C7A",
            fontFamily: "SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            borderRadius: "14px"
        },
        rules: {
            ".Input": {
                padding: "14px",
                backgroundColor: "rgba(12,16,26,0.75)",
                border: "1px solid rgba(255,255,255,0.12)"
            },
            ".Label": {
                color: "rgba(255,255,255,0.7)"
            },
            ".Tab": {
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)"
            },
            ".Tab--selected": {
                backgroundColor: "rgba(107,255,255,0.12)",
                border: "1px solid rgba(107,255,255,0.45)"
            }
        }
    };
    const options = clientSecret ? {
        clientSecret,
        appearance
    } : undefined;
    const handlePaymentElementError = ()=>{
        // Evita loop infinito: só tentamos regenerar 1x automaticamente
        if (loadErrorCountRef.current >= 1) return;
        loadErrorCountRef.current += 1;
        setError("Sessão de pagamento expirou. Vamos criar um novo intento.");
        setLoading(true);
        setCachedIntent(null);
        setClientSecret(null);
        setServerAmount(null);
        setBreakdown(null);
        lastIntentKeyRef.current = null;
        inFlightIntentRef.current = null;
        setGuestSubmitVersion((v)=>v + 1);
        let nextIdemKey;
        try {
            nextIdemKey = crypto.randomUUID();
        } catch  {
            nextIdemKey = undefined;
        }
        atualizarDados({
            additional: {
                ...safeDados?.additional ?? {},
                purchaseId: null,
                paymentIntentId: undefined,
                freeCheckout: undefined,
                appliedPromoLabel: safeDados?.additional?.appliedPromoLabel,
                intentFingerprint: undefined,
                idempotencyKey: nextIdemKey ?? safeDados?.additional?.idempotencyKey
            }
        });
    };
    // Callback chamado pelo AuthWall quando o utilizador faz login/cria conta com sucesso
    const handleAuthenticated = async (newUserId)=>{
        setUserId(newUserId);
        setAuthChecked(true);
        setAuthChecking(false);
        setPurchaseMode("auth");
    // Tentar migrar bilhetes de guest para este user (best-effort)
    // Claim guest será enfileirado depois da compra via /api/me/claim-guest
    };
    // Callback para continuar como convidado
    const handleGuestContinue = ()=>{
        if (requiresAuth) {
            setError("Este tipo de checkout requer sessão iniciada.");
            setPurchaseMode("auth");
            setAuthInfo("Inicia sessão para continuar.");
            return;
        }
        setError(null);
        const localErrors = {};
        if (!guestName.trim()) {
            localErrors.name = "Nome é obrigatório para emitir o bilhete.";
        }
        if (!guestEmail.trim()) {
            localErrors.email = "Email é obrigatório para enviar os bilhetes.";
        } else if (!isValidEmail(guestEmail.trim())) {
            localErrors.email = "Email inválido. Confirma o formato (ex: nome@dominio.com).";
        } else if (guestEmailConfirm.trim() && guestEmailConfirm.trim() !== guestEmail.trim()) {
            localErrors.email = "Email e confirmação não coincidem.";
        }
        const phoneNormalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$phone$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sanitizePhone"])(guestPhone);
        if (phoneNormalized) {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$phone$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isValidPhone"])(phoneNormalized)) {
                localErrors.phone = "Telemóvel inválido. Usa apenas dígitos e opcional + no início.";
            }
        }
        setGuestErrors(localErrors);
        if (localErrors.name || localErrors.email || localErrors.phone) {
            setError("Revê os dados para continuar como convidado.");
            return;
        }
        atualizarDados({
            additional: {
                ...safeDados?.additional ?? {},
                guestName: guestName.trim(),
                guestEmail: guestEmail.trim(),
                guestEmailConfirm: guestEmailConfirm.trim(),
                guestPhone: phoneNormalized || undefined,
                // Reset de estado para evitar reutilização de intents/purchase antigos
                purchaseId: null,
                paymentIntentId: undefined,
                freeCheckout: undefined,
                appliedPromoLabel: undefined,
                clientFingerprint: undefined,
                intentFingerprint: undefined,
                idempotencyKey: crypto.randomUUID()
            }
        });
        setPurchaseMode("guest");
        setClientSecret(null);
        setServerAmount(null);
        setGuestSubmitVersion((v)=>v + 1);
    };
    const showPaymentUI = !authChecking && Boolean(userId) || !isFreeScenario && purchaseMode === "guest" && guestSubmitVersion > 0;
    const handleRemovePromo = ()=>{
        setPromoCode("");
        setPromoInput("");
        setAppliedDiscount(0);
        setAppliedPromoLabel(null);
        setPromoWarning(null);
        setError(null);
        setBreakdown(null);
        setClientSecret(null);
        setServerAmount(null);
        setGuestSubmitVersion((v)=>v + 1);
        try {
            atualizarDados({
                additional: {
                    ...safeDados?.additional ?? {},
                    purchaseId: null,
                    paymentIntentId: undefined,
                    freeCheckout: undefined,
                    appliedPromoLabel: undefined,
                    clientFingerprint: undefined,
                    intentFingerprint: undefined,
                    idempotencyKey: crypto.randomUUID()
                }
            });
        } catch  {}
        lastIntentKeyRef.current = null;
        inFlightIntentRef.current = null;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-6 text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "flex items-start justify-between gap-3",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-1",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] uppercase tracking-[0.18em] text-white/55",
                            children: "Passo 2 de 3"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1350,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-2xl font-semibold leading-tight",
                            children: isFreeScenario ? "Inscrição gratuita" : "Pagamento"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1353,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] text-white/60 max-w-xs",
                            children: isFreeScenario ? "Confirma a tua inscrição. Requer sessão iniciada e username definido." : "Pagamento seguro processado pela Stripe."
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1356,
                            columnNumber: 11
                        }, this),
                        scenario && scenarioCopy[scenario] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] text-white/75 max-w-sm",
                            children: scenarioCopy[scenario]
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1362,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1349,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1348,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-full w-2/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] animate-pulse"
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1368,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1367,
                columnNumber: 7
            }, this),
            authChecking && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative mb-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1375,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1376,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1374,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-sm font-semibold mb-1 animate-pulse",
                        children: "A verificar sessão…"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1378,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] text-white/65 max-w-xs leading-relaxed",
                        children: "Estamos a confirmar se já tens sessão iniciada na ORYA."
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1381,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1373,
                columnNumber: 9
            }, this),
            !authChecking && showPaymentUI ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: error || needsStripe && !stripePromise ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "font-semibold mb-1 flex items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-lg",
                                    children: "⚠️"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1393,
                                    columnNumber: 17
                                }, this),
                                " Ocorreu um problema"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1392,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] mb-4 leading-relaxed",
                            children: error ?? "Configuração de pagamentos indisponível. Tenta novamente mais tarde."
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1395,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>window.location.reload(),
                            className: "rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition",
                            children: "Tentar novamente"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1398,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1391,
                    columnNumber: 13
                }, this) : loading || needsStripe && (!clientSecret || !options) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "relative mb-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1409,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1410,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1408,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-sm font-semibold mb-1 animate-pulse",
                            children: "A preparar o teu pagamento…"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1412,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[11px] text-white/65 max-w-xs leading-relaxed",
                            children: "Estamos a ligar-te à Stripe para criar uma transação segura."
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1415,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1407,
                    columnNumber: 13
                }, this) : error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "font-semibold mb-1 flex items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-lg",
                                    children: "⚠️"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1422,
                                    columnNumber: 17
                                }, this),
                                " Ocorreu um problema"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1421,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[12px] mb-4 leading-relaxed",
                            children: error
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1424,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>window.location.reload(),
                            className: "rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition",
                            children: "Tentar novamente"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1425,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1420,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-4",
                    children: [
                        promoWarning && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100",
                            children: promoWarning
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1436,
                            columnNumber: 17
                        }, this),
                        appliedPromoLabel === "Promo automática" && appliedDiscount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100",
                            children: "Desconto aplicado automaticamente 🎉"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1441,
                            columnNumber: 17
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-xs text-white/70",
                                    children: "Tens um código promocional?"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1446,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-2 sm:flex-row",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            value: promoInput,
                                            onChange: (e)=>setPromoInput(e.target.value),
                                            placeholder: "Insere o código",
                                            className: "flex-1 rounded-xl bg-white/[0.05] border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 1448,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>{
                                                setPromoWarning(null);
                                                setError(null);
                                                if (!promoInput.trim()) {
                                                    setPromoWarning("Escreve um código antes de aplicar.");
                                                    return;
                                                }
                                                // Promo altera o cálculo: limpamos purchase/payment state para obrigar a recalcular intent.
                                                try {
                                                    atualizarDados({
                                                        additional: {
                                                            ...safeDados?.additional ?? {},
                                                            purchaseId: null,
                                                            paymentIntentId: undefined,
                                                            freeCheckout: undefined,
                                                            appliedPromoLabel: undefined,
                                                            intentFingerprint: crypto.randomUUID(),
                                                            idempotencyKey: crypto.randomUUID()
                                                        }
                                                    });
                                                } catch  {}
                                                setCachedIntent(null);
                                                setClientSecret(null);
                                                setServerAmount(null);
                                                setBreakdown(null);
                                                lastIntentKeyRef.current = null;
                                                inFlightIntentRef.current = null;
                                                setPromoCode(promoInput.trim());
                                                setGuestSubmitVersion((v)=>v + 1);
                                            },
                                            className: "px-4 py-2 rounded-full bg-white text-black text-sm font-semibold shadow hover:scale-[1.01] active:scale-[0.99] transition",
                                            children: "Aplicar"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 1455,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1447,
                                    columnNumber: 17
                                }, this),
                                appliedDiscount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: appliedPromoLabel ? `Desconto ${appliedPromoLabel}: -${appliedDiscount.toFixed(2)} €` : `Desconto aplicado: -${appliedDiscount.toFixed(2)} €`
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 1494,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: handleRemovePromo,
                                            className: "rounded-full border border-emerald-300/40 px-2 py-0.5 text-[11px] text-emerald-50 hover:bg-emerald-500/20",
                                            children: "Remover"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 1499,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1493,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1445,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$react$2d$stripe$2d$js$2f$dist$2f$react$2d$stripe$2e$esm$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Elements"], {
                            stripe: stripePromise,
                            options: options,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PaymentForm, {
                                total: total,
                                discount: appliedDiscount,
                                breakdown: breakdown ?? undefined,
                                clientSecret: clientSecret,
                                onLoadError: handlePaymentElementError
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1510,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1509,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1434,
                    columnNumber: 13
                }, this)
            }, void 0, false) : null,
            !authChecking && !userId && !showPaymentUI && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    authInfo && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-[11px] text-amber-50",
                        children: authInfo
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1527,
                        columnNumber: 13
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-[11px] text-red-50",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1532,
                        columnNumber: 13
                    }, this),
                    !requiresAuth && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 text-[11px] bg-white/10 rounded-full p-1 border border-white/15 w-fit backdrop-blur",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setPurchaseMode("guest"),
                                className: `px-3 py-1 rounded-full ${purchaseMode === "guest" ? "bg-white text-black font-semibold" : "text-white/70"}`,
                                children: "Comprar como convidado"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1538,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>{
                                    setPurchaseMode("auth");
                                    setClientSecret(null);
                                    setServerAmount(null);
                                },
                                className: `px-3 py-1 rounded-full ${purchaseMode === "auth" ? "bg-white text-black font-semibold" : "text-white/70"}`,
                                children: "Entrar / Criar conta"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1549,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1537,
                        columnNumber: 13
                    }, this),
                    requiresAuth ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-50",
                                children: "Este checkout exige conta. Para eventos gratuitos precisas de iniciar sessão e ter um username definido."
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1569,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthWall, {
                                onAuthenticated: handleAuthenticated
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1572,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1568,
                        columnNumber: 13
                    }, this) : purchaseMode === "guest" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(GuestCheckoutCard, {
                        guestName: guestName,
                        guestEmail: guestEmail,
                        guestEmailConfirm: guestEmailConfirm,
                        guestPhone: guestPhone,
                        guestErrors: guestErrors,
                        onChangeName: setGuestName,
                        onChangeEmail: setGuestEmail,
                        onChangeEmailConfirm: setGuestEmailConfirm,
                        onChangePhone: setGuestPhone,
                        onContinue: handleGuestContinue
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1575,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthWall, {
                        onAuthenticated: handleAuthenticated
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1588,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1525,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
        lineNumber: 1347,
        columnNumber: 5
    }, this);
}
function PaymentForm({ total, discount = 0, breakdown, clientSecret, onLoadError }) {
    const stripe = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$react$2d$stripe$2d$js$2f$dist$2f$react$2d$stripe$2e$esm$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useStripe"])();
    const elements = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$react$2d$stripe$2d$js$2f$dist$2f$react$2d$stripe$2e$esm$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useElements"])();
    const { irParaPasso, atualizarDados, dados } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    const [submitting, setSubmitting1] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [elementReady, setElementReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const currency = breakdown?.currency ?? "EUR";
    const discountCents = Math.max(0, Math.round(discount * 100));
    const hasInvoice = Boolean(breakdown?.lines?.length);
    const feeMode = typeof breakdown?.feeMode === "string" ? breakdown.feeMode.toUpperCase() : null;
    const payorPaysFee = feeMode === "ADDED";
    const platformFeeCents = payorPaysFee ? Math.max(0, breakdown?.platformFeeCombinedCents ?? breakdown?.platformFeeCents ?? 0) : 0;
    const subtotalCents = breakdown?.subtotalCents ?? 0;
    const baseSubtotalCents = hasInvoice && discountCents > 0 ? subtotalCents + discountCents : subtotalCents;
    const promoApplied = discountCents > 0;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        // sempre que o clientSecret muda, obrigamos o PaymentElement a fazer ready novamente
        setElementReady(false);
    }, [
        clientSecret
    ]);
    // Proteção: se o PaymentIntent já estiver terminal (succeeded/canceled), força regenerar.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!stripe || !clientSecret) return;
        let cancelled = false;
        (async ()=>{
            try {
                const pi = await stripe.retrievePaymentIntent(clientSecret);
                if (cancelled) return;
                const status = pi.paymentIntent?.status;
                if (status && ![
                    "requires_payment_method",
                    "requires_action",
                    "requires_confirmation"
                ].includes(status)) {
                    setError("Sessão de pagamento expirou. Vamos criar um novo intento.");
                    if (onLoadError) onLoadError();
                }
            } catch (err) {
                if (cancelled) return;
                setError("Falha ao validar estado do pagamento. Tenta novamente.");
                if (onLoadError) onLoadError();
            }
        })();
        return ()=>{
            cancelled = true;
        };
    }, [
        stripe,
        clientSecret,
        onLoadError
    ]);
    // Se o utilizador for redirecionado pela Stripe (ex.: 3DS), o URL volta com
    // `payment_intent_client_secret` e `redirect_status`. Aqui recuperamos o PI
    // e avançamos automaticamente para o passo 3 quando o pagamento fica concluído.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!stripe) return;
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const params = undefined;
        const clientSecretFromUrl = undefined;
        let cancelled;
    }, [
        stripe,
        atualizarDados,
        dados?.additional,
        dados?.eventId,
        irParaPasso,
        currency,
        total,
        discountCents
    ]);
    async function handleSubmit(e) {
        e.preventDefault();
        if (!stripe || !elements || !elementReady) return;
        setSubmitting1(true);
        setError(null);
        try {
            const returnUrl = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined;
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined,
                redirect: "if_required"
            });
            if (error) {
                setError(error.message ?? "O pagamento não foi concluído.");
                return;
            }
            if (paymentIntent && paymentIntent.status === "succeeded") {
                atualizarDados({
                    additional: {
                        ...dados?.additional ?? {},
                        paymentIntentId: paymentIntent.id
                    }
                });
                try {
                    const { trackEvent } = await __turbopack_context__.A("[project]/lib/analytics.ts [app-ssr] (ecmascript, async loader)");
                    trackEvent("checkout_payment_confirmed", {
                        eventId: dados?.eventId,
                        promoApplied,
                        currency,
                        totalCents: total ? Math.round(total * 100) : null
                    });
                } catch (err) {
                    console.warn("[trackEvent] checkout_payment_confirmed falhou", err);
                }
                irParaPasso(3);
            }
        } catch (err) {
            console.error("Erro ao confirmar pagamento:", err);
            setError("Erro inesperado ao confirmar o pagamento.");
        } finally{
            setSubmitting1(false);
        }
    }
    if (!clientSecret) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "font-semibold mb-1 flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-lg",
                            children: "⚠️"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1801,
                            columnNumber: 11
                        }, this),
                        " Não foi possível preparar o pagamento."
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1800,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[12px] mb-4 leading-relaxed",
                    children: "Volta atrás e tenta novamente ou recarrega a página."
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1803,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>window.location.reload(),
                            className: "rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition",
                            children: "Recarregar"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1807,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>irParaPasso(1),
                            className: "rounded-full border border-white/30 px-5 py-1.5 text-[11px] text-white hover:bg-white/10 transition",
                            children: "Voltar"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 1814,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                    lineNumber: 1806,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
            lineNumber: 1799,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        onSubmit: handleSubmit,
        className: "flex flex-col gap-5",
        children: [
            (hasInvoice || total !== null) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-4 shadow-inner shadow-black/40 backdrop-blur-xl space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between text-xs text-white/70",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "uppercase tracking-[0.14em]",
                                children: "Resumo"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1831,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10 text-[11px] text-white/70",
                                children: "🔒 Pagamento seguro"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1832,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1830,
                        columnNumber: 11
                    }, this),
                    hasInvoice && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2",
                        children: [
                            breakdown?.lines?.map((line)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between text-sm text-white/80",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-medium",
                                                    children: line.name
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 1845,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[11px] text-white/55",
                                                    children: [
                                                        "x",
                                                        line.quantity
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 1846,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 1844,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-right",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[13px] font-semibold",
                                                    children: formatMoney(line.lineTotalCents, line.currency || currency)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 1849,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-white/45",
                                                    children: [
                                                        formatMoney(line.unitPriceCents, line.currency || currency),
                                                        " / bilhete"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 1852,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 1848,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, `${line.ticketTypeId}-${line.name}-${line.quantity}`, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 1840,
                                    columnNumber: 17
                                }, this)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-px w-full bg-white/10"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1859,
                                columnNumber: 15
                            }, this),
                            discountCents > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between text-sm text-white/70",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "Subtotal (antes de desconto)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                lineNumber: 1864,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-semibold",
                                                children: formatMoney(baseSubtotalCents, currency)
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                lineNumber: 1865,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1863,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between text-sm text-emerald-300",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "Desconto aplicado"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                lineNumber: 1870,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    "-",
                                                    formatMoney(discountCents, currency)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                lineNumber: 1871,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1869,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between text-sm text-white/80",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Subtotal"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1877,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: formatMoney(subtotalCents, currency)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1878,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1876,
                                columnNumber: 15
                            }, this),
                            platformFeeCents > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between text-sm text-white/70",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Taxa da plataforma (inclui processamento)"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1885,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: formatMoney(platformFeeCents, currency)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1886,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1884,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1838,
                        columnNumber: 13
                    }, this),
                    total !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 border border-white/12",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col text-white/80",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[12px]",
                                        children: "Total a pagar"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1895,
                                        columnNumber: 17
                                    }, this),
                                    feeMode === "INCLUDED" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[11px] text-white/55",
                                        children: "Taxas já incluídas"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 1897,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1894,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xl font-semibold text-white",
                                children: formatMoney(Math.round(total * 100), currency)
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1902,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1893,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1829,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-4 text-sm backdrop-blur-xl payment-scroll",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between text-[11px] text-white/70 mb-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "uppercase tracking-[0.16em]",
                                children: "Método de pagamento"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1912,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70",
                                children: "Stripe"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1913,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1911,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative",
                        children: [
                            !elementReady && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute inset-0 rounded-xl border border-white/10 bg-white/5 animate-pulse pointer-events-none"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1919,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stripe$2f$react$2d$stripe$2d$js$2f$dist$2f$react$2d$stripe$2e$esm$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PaymentElement"], {
                                options: {},
                                onReady: ()=>setElementReady(true),
                                onLoadError: (err)=>{
                                    console.error("[PaymentElement] loaderror", err);
                                    setElementReady(false);
                                    setError(err?.message ?? "Não foi possível carregar o formulário de pagamento. Tenta novamente.");
                                    if (onLoadError) onLoadError();
                                    // Debug extra: tentar perceber o estado do PI associado
                                    if (stripe && clientSecret) {
                                        stripe.retrievePaymentIntent(clientSecret).then((res)=>{
                                            console.warn("[PaymentElement] PI status", res.paymentIntent?.status, res.paymentIntent?.id);
                                        }).catch(()=>undefined);
                                    }
                                }
                            }, clientSecret ?? "payment-element", false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 1921,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 1917,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1910,
                columnNumber: 7
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[11px] text-red-300 mt-1 leading-snug",
                children: error
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1946,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "submit",
                disabled: submitting || !stripe || !elements || !elementReady,
                className: "mt-3 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-3 text-xs font-semibold text-black shadow-[0_0_32px_rgba(107,255,255,0.55)] disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-95 transition-transform",
                children: submitting ? "A processar…" : "Pagar agora"
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1949,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 text-[10px] text-white/40 text-center leading-snug",
                children: "Pagamento seguro processado pela Stripe. A ORYA nunca guarda dados do teu cartão."
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 1957,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
        lineNumber: 1827,
        columnNumber: 5
    }, this);
}
function delay(ms) {
    return new Promise((resolve)=>setTimeout(resolve, ms));
}
function AuthWall({ onAuthenticated }) {
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("login");
    const [identifier, setIdentifier] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [confirmPassword, setConfirmPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [fullName, setFullName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [username, setUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [submitting, setSubmitting1] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [otp, setOtp] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [authOtpCooldown, setAuthOtpCooldown] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [authOtpResending, setAuthOtpResending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    function isUnconfirmedError(err) {
        if (!err) return false;
        const anyErr = err;
        const msg = (anyErr.message || anyErr.error_description || "").toLowerCase();
        return msg.includes("not confirmed") || msg.includes("confirm your email") || msg.includes("email_not_confirmed");
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (authOtpCooldown <= 0) return;
        const t = setInterval(()=>{
            setAuthOtpCooldown((prev)=>prev > 0 ? prev - 1 : 0);
        }, 1000);
        return ()=>clearInterval(t);
    }, [
        authOtpCooldown
    ]);
    async function triggerResendOtp(email) {
        setError(null);
        setAuthOtpResending(true);
        setAuthOtpCooldown(60);
        try {
            const res = await fetch("/api/auth/resend-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email
                })
            });
            const data = await res.json().catch(()=>null);
            if (!res.ok) {
                setError(data?.error ?? "Não foi possível reenviar o código.");
                setAuthOtpCooldown(0);
            }
        } catch (err) {
            console.error("[AuthWall] resend OTP error:", err);
            setError("Não foi possível reenviar o código.");
            setAuthOtpCooldown(0);
        } finally{
            setAuthOtpResending(false);
        }
    }
    async function handleGoogle() {
        setSubmitting1(true);
        setError(null);
        try {
            const redirectTo = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined;
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo
                }
            });
            if (error) {
                setError(error.message ?? "Não foi possível iniciar sessão com Google.");
            }
        } catch (err) {
            console.error("[AuthWall] Google OAuth error:", err);
            setError("Não foi possível iniciar sessão com Google.");
        } finally{
            setSubmitting1(false);
        }
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting1(true);
        setError(null);
        try {
            if (mode === "verify") {
                if (!identifier || !otp.trim()) {
                    setError("Indica o email e o código recebido.");
                    return;
                }
                const emailToUse = identifier.trim().toLowerCase();
                const token = otp.trim();
                const { error: verifyErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.verifyOtp({
                    type: "signup",
                    email: emailToUse,
                    token
                });
                if (verifyErr) {
                    setError(verifyErr.message || "Código inválido ou expirado.");
                    setAuthOtpCooldown(0);
                    return;
                }
                await delay(400);
                const { data: userData } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.getUser();
                if (userData?.user) onAuthenticated?.(userData.user.id);
                return;
            }
            if (!identifier || !password) {
                setError("Preenche o email e a palavra-passe.");
                return;
            }
            let emailToUse = identifier.trim().toLowerCase();
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
                    return;
                }
                emailToUse = data.email;
            }
            if (mode === "login") {
                const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.signInWithPassword({
                    email: emailToUse,
                    password
                });
                if (error) {
                    if (isUnconfirmedError(error)) {
                        setMode("verify");
                        setIdentifier(emailToUse);
                        setError("Email ainda não confirmado. Reenviei-te um novo código.");
                        await triggerResendOtp(emailToUse);
                        return;
                    }
                    setError(error.message ?? "Não foi possível iniciar sessão.");
                    return;
                }
            } else {
                if (password.length < 6) {
                    setError("A password deve ter pelo menos 6 caracteres.");
                    return;
                }
                if (password !== confirmPassword) {
                    setError("As passwords não coincidem.");
                    return;
                }
                if (!fullName.trim()) {
                    setError("Nome é obrigatório para criar conta.");
                    return;
                }
                const usernameCheck = await checkUsernameAvailability(username);
                if (!usernameCheck.ok) {
                    setSubmitting1(false);
                    return;
                }
                const res = await fetch("/api/auth/send-otp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: emailToUse,
                        password,
                        username: usernameCheck.username,
                        fullName: fullName.trim()
                    })
                });
                const data = await res.json().catch(()=>null);
                if (!res.ok || !data?.ok) {
                    const message = data?.error ?? "Não foi possível enviar o código de verificação.";
                    setError(message);
                    return;
                }
                setMode("verify");
                setIdentifier(emailToUse);
                setError("Enviámos um código para confirmar o email. Introduz para continuares.");
                setAuthOtpCooldown(60);
                return;
            }
            // Pequeno delay para garantir que a sessão foi escrita nos cookies
            await delay(600);
            // Depois do delay, garantimos que a sessão está disponível e notificamos o Step2
            try {
                const { data: userData } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseBrowser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabaseBrowser"].auth.getUser();
                if (userData?.user) {
                    onAuthenticated?.(userData.user.id);
                }
            } catch (e) {
                console.warn("[AuthWall] Não foi possível ler user após login:", e);
            }
        } catch (err) {
            console.error("[AuthWall] Erro:", err);
            setError("Ocorreu um erro. Tenta novamente.");
        } finally{
            setSubmitting1(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col gap-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-start justify-between gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "text-sm font-semibold mb-1",
                                children: "Inicia sessão para continuar"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2189,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] text-white/60 max-w-sm leading-relaxed",
                                children: "Para associar os bilhetes à tua conta ORYA e evitar problemas no check-in, tens de estar com a sessão iniciada antes de pagar."
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2192,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2188,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[20px]",
                        children: "🔐"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2197,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 2187,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                onSubmit: handleSubmit,
                className: "flex flex-col gap-3 mt-2",
                children: [
                    mode !== "verify" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2 text-[11px] bg-black/40 rounded-full p-1 border border-white/10 w-fit",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setMode("login"),
                                className: `px-3 py-1 rounded-full ${mode === "login" ? "bg-white text-black font-semibold" : "text-white/70"}`,
                                children: "Já tenho conta"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2203,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>setMode("signup"),
                                className: `px-3 py-1 rounded-full ${mode === "signup" ? "bg-white text-black font-semibold" : "text-white/70"}`,
                                children: "Criar conta"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2210,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2202,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-2 text-[12px]",
                        children: mode !== "verify" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-white/70",
                                            children: "Email"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2224,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "email",
                                            className: "w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                                            placeholder: "nome@exemplo.com",
                                            value: identifier,
                                            onChange: (e)=>setIdentifier(e.target.value),
                                            autoComplete: "email"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2225,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 2223,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-white/70",
                                            children: "Palavra-passe"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2235,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "password",
                                            className: "w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                                            placeholder: "••••••••",
                                            value: password,
                                            onChange: (e)=>setPassword(e.target.value),
                                            autoComplete: mode === "login" ? "current-password" : "new-password"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2236,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 2234,
                                    columnNumber: 15
                                }, this),
                                mode === "signup" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "text-white/70",
                                                    children: "Confirmar palavra-passe"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 2248,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "password",
                                                    className: "w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                                                    placeholder: "••••••••",
                                                    value: confirmPassword,
                                                    onChange: (e)=>setConfirmPassword(e.target.value),
                                                    autoComplete: "new-password"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 2249,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2247,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "text-white/70",
                                                    children: "Nome completo"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 2259,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "text",
                                                    className: "w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                                                    placeholder: "O teu nome",
                                                    value: fullName,
                                                    onChange: (e)=>setFullName(e.target.value),
                                                    autoComplete: "name"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 2260,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2258,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "text-white/70",
                                                    children: "Username"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 2270,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "text",
                                                    className: "w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                                                    placeholder: "@teuuser",
                                                    value: username,
                                                    onChange: (e)=>setUsername(e.target.value),
                                                    autoComplete: "username"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                                    lineNumber: 2271,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2269,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true)
                            ]
                        }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[12px] text-white/70",
                                    children: [
                                        "Enviámos um código de confirmação para ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: identifier
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2286,
                                            columnNumber: 56
                                        }, this),
                                        ". Introduz abaixo ou pede novo código."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 2285,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-white/70",
                                            children: "Código"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2289,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            maxLength: 8,
                                            className: "w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]",
                                            placeholder: "87612097",
                                            value: otp,
                                            onChange: (e)=>setOtp(e.target.value),
                                            autoComplete: "one-time-code"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2290,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 2288,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-[11px] text-white/65 flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                "Não chegou? ",
                                                authOtpCooldown > 0 ? `Podes reenviar em ${authOtpCooldown}s.` : "Reenvia um novo código."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2301,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>identifier && triggerResendOtp(identifier),
                                            disabled: authOtpCooldown > 0 || authOtpResending || !identifier,
                                            className: "text-[#6BFFFF] hover:text-white transition disabled:opacity-50",
                                            children: "Reenviar código"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                            lineNumber: 2304,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                    lineNumber: 2300,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true)
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2220,
                        columnNumber: 9
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] text-red-300 mt-1 leading-snug",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2318,
                        columnNumber: 11
                    }, this),
                    authOtpCooldown > 0 && mode === "verify" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] text-white/60",
                        children: [
                            "Podes reenviar código em ",
                            authOtpCooldown,
                            "s."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2321,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: handleGoogle,
                        disabled: submitting,
                        className: "inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-black/50 px-6 py-2.5 text-xs font-semibold text-white shadow hover:border-white/40 hover:bg-black/60 transition-colors disabled:opacity-50",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "Continuar com Google"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                            lineNumber: 2330,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2324,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "submit",
                        disabled: submitting,
                        className: "mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-xs font-semibold text-black shadow-[0_0_24px_rgba(107,255,255,0.55)] disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-transform",
                        children: mode === "verify" ? submitting ? "A confirmar…" : "Confirmar código e continuar" : mode === "login" ? submitting ? "A entrar…" : "Iniciar sessão e continuar" : submitting ? "A enviar código…" : "Criar conta e enviar código"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2333,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 2200,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
        lineNumber: 2186,
        columnNumber: 5
    }, this);
}
function GuestCheckoutCard({ guestName, guestEmail, guestEmailConfirm, guestPhone, guestErrors, onChangeName, onChangeEmail, onChangeEmailConfirm, onChangePhone, onContinue }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 rounded-2xl border border-white/12 bg-white/[0.06] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col gap-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-start justify-between gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "text-sm font-semibold mb-1",
                                children: "Continuar como convidado"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2384,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] text-white/60 max-w-sm leading-relaxed",
                                children: "Compra em 30 segundos. Guardamos os teus bilhetes pelo email e podes criar conta depois para os ligar ao teu perfil."
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2385,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-2 space-y-1 text-[11px] text-white/55",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: "• Email é usado para entregar bilhetes e recibo."
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 2390,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: "• Telefone ajuda no contacto no dia do evento (opcional)."
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                        lineNumber: 2391,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2389,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2383,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[20px]",
                        children: "🎟️"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2394,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 2382,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col gap-3 text-[12px]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-white/70",
                                children: "Nome completo"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2399,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "text",
                                className: `w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${guestErrors.name ? "border-red-400/70" : "border-white/15"}`,
                                placeholder: "Como queres que apareça no bilhete",
                                value: guestName,
                                onChange: (e)=>onChangeName(e.target.value),
                                autoComplete: "name"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2400,
                                columnNumber: 11
                            }, this),
                            guestErrors.name && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[11px] text-red-300",
                                children: guestErrors.name
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2411,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2398,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-white/70",
                                children: "Email"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2415,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "email",
                                className: `w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${guestErrors.email ? "border-red-400/70" : "border-white/15"}`,
                                placeholder: "nome@exemplo.com",
                                value: guestEmail,
                                onChange: (e)=>onChangeEmail(e.target.value),
                                autoComplete: "email"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2416,
                                columnNumber: 11
                            }, this),
                            guestErrors.email && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[11px] text-red-300",
                                children: guestErrors.email
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2427,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2414,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-white/70",
                                children: "Confirmar email"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2431,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "email",
                                className: `w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${guestErrors.email ? "border-red-400/70" : "border-white/15"}`,
                                placeholder: "repete o teu email",
                                value: guestEmailConfirm,
                                onChange: (e)=>onChangeEmailConfirm(e.target.value),
                                autoComplete: "email"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2432,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2430,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-white/70",
                                children: "Telemóvel (opcional)"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2444,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "tel",
                                inputMode: "tel",
                                className: `w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${guestErrors.phone ? "border-red-400/70" : "border-white/15"}`,
                                placeholder: "+351 ...",
                                value: guestPhone,
                                onChange: (e)=>{
                                    const sanitized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$phone$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sanitizePhone"])(e.target.value);
                                    onChangePhone(sanitized);
                                },
                                autoComplete: "tel"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2445,
                                columnNumber: 11
                            }, this),
                            guestErrors.phone && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[11px] text-red-300",
                                children: guestErrors.phone
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                                lineNumber: 2460,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                        lineNumber: 2443,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 2397,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: onContinue,
                className: "mt-1 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-xs font-semibold text-black shadow-[0_0_24px_rgba(107,255,255,0.55)] hover:scale-[1.02] active:scale-95 transition-transform",
                children: "Continuar como convidado"
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 2465,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-[10px] text-white/40 leading-snug",
                children: "Vamos enviar os bilhetes para este email. Depois podes criar conta e migrar todos os bilhetes para o teu perfil."
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
                lineNumber: 2473,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/checkout/Step2Pagamento.tsx",
        lineNumber: 2381,
        columnNumber: 5
    }, this);
}
}),
"[project]/lib/money.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// lib/money.ts
__turbopack_context__.s([
    "centsToEuro",
    ()=>centsToEuro,
    "formatEuro",
    ()=>formatEuro
]);
const EUR_NUMBER_FORMATTER = new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
function formatEuro(amount) {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "";
    // Intl usa espaços não separáveis em PT; trocamos para espaço normal para evitar chars estranhos.
    const formatted = EUR_NUMBER_FORMATTER.format(amount).replace(/\u00A0/g, " ");
    return `${formatted} €`;
}
function centsToEuro(cents) {
    if (cents === null || cents === undefined || Number.isNaN(cents)) return null;
    return cents / 100;
}
}),
"[project]/app/components/checkout/Step3Sucesso.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Step3Sucesso
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/money.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";
const scenarioCopy = {
    GROUP_SPLIT: "Pagaste apenas a tua parte desta dupla.",
    GROUP_FULL: "Pagaste 2 lugares (tu + parceiro).",
    RESALE: "Compra de bilhete em revenda.",
    FREE_CHECKOUT: "Inscrição gratuita concluída."
};
function normalizeCheckoutStatus(raw) {
    const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if ([
        "PAID",
        "OK",
        "SUCCEEDED",
        "SUCCESS",
        "COMPLETED",
        "CONFIRMED"
    ].includes(v)) return "PAID";
    if ([
        "FAILED",
        "ERROR",
        "CANCELED",
        "CANCELLED",
        "REQUIRES_PAYMENT_METHOD"
    ].includes(v)) return "FAILED";
    return "PROCESSING";
}
function numberFromUnknown(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function eurosToCents(v) {
    return Math.max(0, Math.round(v * 100));
}
function centsFromAdditional(additional, key) {
    // Convention used in this checkout:
    // - `*Cents` fields are cents
    // - `total` (without suffix) has historically been stored as euros
    const centsKey = `${key}Cents`;
    const cents = numberFromUnknown(additional[centsKey]);
    if (cents !== null) return cents;
    if (key === "total") {
        const totalEuros = numberFromUnknown(additional.total);
        if (totalEuros !== null) return eurosToCents(totalEuros);
    }
    return null;
}
function Step3Sucesso() {
    const { dados, fecharCheckout, breakdown: checkoutBreakdown } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const [statusError, setStatusError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const additional = dados?.additional && typeof dados.additional === "object" ? dados.additional : undefined;
    const scenario = dados?.paymentScenario ?? (additional && typeof additional.paymentScenario === "string" ? additional.paymentScenario : null);
    const isFreeScenario = scenario === "FREE_CHECKOUT";
    const paymentIntentId = additional && typeof additional.paymentIntentId === "string" ? additional.paymentIntentId : null;
    const fallbackPurchaseId = paymentIntentId && paymentIntentId !== FREE_PLACEHOLDER_INTENT_ID ? paymentIntentId : null;
    const purchaseId = additional && typeof additional.purchaseId === "string" ? additional.purchaseId : fallbackPurchaseId;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (dados && !purchaseId && !isFreeScenario) {
            router.replace("/explorar");
        }
    }, [
        dados,
        router,
        purchaseId,
        isFreeScenario
    ]);
    // Revalidar bilhetes após sucesso (traz novos bilhetes mais depressa)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        async function revalidateTickets() {
            try {
                await fetch("/api/me/wallet", {
                    method: "GET",
                    cache: "no-store"
                });
            } catch (err) {
                console.warn("[Step3Sucesso] Falha ao revalidar /api/me/wallet", err);
            }
        }
        revalidateTickets();
    }, []);
    const guestEmail = additional && typeof additional.guestEmail === "string" ? additional.guestEmail : null;
    const breakdown = (()=>{
        const add = additional ?? {};
        const subtotalFromContext = typeof checkoutBreakdown?.subtotalCents === "number" ? checkoutBreakdown.subtotalCents : null;
        const subtotalFromLines = checkoutBreakdown?.lines?.reduce((sum, line)=>sum + Number(line.lineTotalCents ?? 0), 0) ?? null;
        // If we lost the context breakdown (refresh), we fallback to additional.
        // NOTE: `additional.total` is stored as euros in Step2, so we convert to cents.
        const subtotalCentsRaw = subtotalFromContext ?? numberFromUnknown(add.subtotalCents) ?? numberFromUnknown(add.totalCents) ?? centsFromAdditional(add, "total") ?? 0;
        const subtotalCents = subtotalCentsRaw && subtotalCentsRaw > 0 ? subtotalCentsRaw : subtotalFromLines && subtotalFromLines > 0 ? subtotalFromLines : 0;
        const feeModeRaw = typeof checkoutBreakdown?.feeMode === "string" ? checkoutBreakdown.feeMode : typeof add.feeMode === "string" ? add.feeMode : null;
        const feeMode = typeof feeModeRaw === "string" ? feeModeRaw.toUpperCase() : null;
        const discountCents = typeof checkoutBreakdown?.discountCents === "number" ? checkoutBreakdown.discountCents : numberFromUnknown(add.discountCents) ?? 0;
        const platformFeeOryaCents = typeof checkoutBreakdown?.platformFeeOryaCents === "number" ? checkoutBreakdown.platformFeeOryaCents : numberFromUnknown(add.platformFeeOryaCents) ?? numberFromUnknown(add.platformFeeCents) ?? 0;
        const platformFeeCombinedCents = typeof checkoutBreakdown?.platformFeeCombinedCents === "number" ? checkoutBreakdown.platformFeeCombinedCents : numberFromUnknown(add.platformFeeCents) ?? platformFeeOryaCents;
        // Só mostrar/contabilizar taxa se o modo for ADDED (pago pelo comprador).
        const payorPaysFee = feeMode === "ADDED";
        const platformFeeCents = payorPaysFee ? platformFeeCombinedCents : 0;
        const totalCentsFromContext = typeof checkoutBreakdown?.totalCents === "number" ? checkoutBreakdown.totalCents : null;
        const totalCentsFromAdditional = numberFromUnknown(add.totalCents) ?? centsFromAdditional(add, "total");
        const computedTotalFallback = Math.max(0, subtotalCents - discountCents + platformFeeCents);
        const totalCents = totalCentsFromContext ?? totalCentsFromAdditional ?? computedTotalFallback;
        const code = typeof add.appliedPromoLabel === "string" ? add.appliedPromoLabel : typeof add.promoCodeRaw === "string" ? add.promoCodeRaw : typeof add.promoCode === "string" ? add.promoCode : null;
        const currency = typeof checkoutBreakdown?.currency === "string" ? checkoutBreakdown.currency : typeof add.currency === "string" ? add.currency : "EUR";
        if (Number.isNaN(subtotalCents) && Number.isNaN(discountCents) && Number.isNaN(platformFeeCents) && Number.isNaN(totalCents)) {
            return null;
        }
        return {
            subtotalCents,
            discountCents,
            platformFeeCents,
            totalCents,
            code,
            currency,
            feeMode
        };
    })();
    const subtotalEur = breakdown ? breakdown.subtotalCents / 100 : null;
    const discountEur = breakdown ? breakdown.discountCents / 100 : null;
    const platformFeeEur = breakdown ? (breakdown.platformFeeCombinedCents ?? breakdown.platformFeeCents) / 100 : null;
    const totalEur = breakdown ? breakdown.totalCents / 100 : null;
    const initialStatus = isFreeScenario ? "PAID" : purchaseId ? "PROCESSING" : "PROCESSING";
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialStatus);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isFreeScenario) setStatus("PAID");
    }, [
        isFreeScenario
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!purchaseId || isFreeScenario) return;
        let cancelled = false;
        let interval = null;
        const poll = async ()=>{
            try {
                const url = new URL("/api/checkout/status", window.location.origin);
                url.searchParams.set("purchaseId", purchaseId);
                if (paymentIntentId && paymentIntentId !== purchaseId) {
                    url.searchParams.set("paymentIntentId", paymentIntentId);
                }
                const res = await fetch(url.toString(), {
                    cache: "no-store"
                });
                const data = await res.json().catch(()=>null);
                const mapped = normalizeCheckoutStatus(data?.status);
                if (cancelled) return;
                if (mapped === "PAID") {
                    setStatus("PAID");
                    setStatusError(null);
                    if (interval) clearInterval(interval);
                    // revalidate once more after confirmed
                    try {
                        await fetch("/api/me/wallet", {
                            method: "GET",
                            cache: "no-store"
                        });
                    } catch  {}
                    return;
                }
                if (mapped === "FAILED") {
                    setStatus("FAILED");
                    setStatusError(typeof data?.error === "string" ? data.error : null);
                    if (interval) clearInterval(interval);
                    return;
                }
                setStatus("PROCESSING");
                setStatusError(null);
            } catch (err) {
                console.warn("[Step3Sucesso] Poll status falhou", err);
                if (!cancelled) setStatusError(null);
            }
        };
        poll();
        interval = setInterval(poll, 3000);
        return ()=>{
            cancelled = true;
            if (interval) clearInterval(interval);
        };
    }, [
        purchaseId,
        isFreeScenario
    ]);
    if (!dados) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-center space-y-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "text-xl font-semibold text-black",
                    children: "Algo correu mal 🤔"
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                    lineNumber: 273,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-black/70",
                    children: "Não encontrámos os dados do bilhete. Fecha esta janela e tenta novamente."
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                    lineNumber: 274,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: fecharCheckout,
                    className: "mt-4 w-full rounded-xl bg-black text-white py-2 text-sm font-medium hover:bg-black/80",
                    children: "Fechar"
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                    lineNumber: 277,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
            lineNumber: 272,
            columnNumber: 7
        }, this);
    }
    if (!purchaseId && !isFreeScenario) {
        return null;
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center text-center gap-6 py-6 px-4 text-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] uppercase tracking-[0.18em] text-white/55",
                        children: "Passo 3 de 3"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 294,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-full w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                            lineNumber: 298,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 297,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                lineNumber: 293,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-3xl font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent",
                        children: status === "PAID" ? isFreeScenario ? "Inscrição confirmada 🎉" : "Compra Confirmada 🎉" : status === "FAILED" ? "Pagamento não confirmado" : "A confirmar pagamento…"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 304,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-white/70",
                        children: status === "FAILED" ? statusError ?? "Não conseguimos confirmar o pagamento. Tenta novamente ou contacta suporte." : status === "PAID" ? guestEmail ? `Obrigado! Enviámos os teus bilhetes para ${guestEmail}.` : isFreeScenario ? "A tua inscrição gratuita está confirmada." : "Compra confirmada. Já podes ver os teus bilhetes." : guestEmail ? `Estamos a confirmar o pagamento. Assim que estiver confirmado, vais receber os bilhetes em ${guestEmail}.` : "Estamos a confirmar o pagamento. Mantém esta página aberta."
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 313,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                lineNumber: 303,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/12 px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.55)] space-y-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-widest text-white/50",
                                children: "Evento"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                lineNumber: 333,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xl font-semibold",
                                children: dados.ticketName ?? "Bilhete"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                lineNumber: 334,
                                columnNumber: 11
                            }, this),
                            scenario && scenarioCopy[scenario] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] text-white/70",
                                children: scenarioCopy[scenario]
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                lineNumber: 338,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 332,
                        columnNumber: 9
                    }, this),
                    status === "PAID" && breakdown && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2 text-sm text-white/80",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between border-b border-white/10 pb-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white/60 text-[11px] uppercase tracking-widest",
                                        children: "Total dos bilhetes"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 346,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(subtotalEur)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 347,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                lineNumber: 345,
                                columnNumber: 13
                            }, this),
                            breakdown.discountCents > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white/60",
                                        children: [
                                            "Desconto ",
                                            breakdown.code ? `(${breakdown.code})` : ""
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 353,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-emerald-300",
                                        children: [
                                            "-",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(discountEur)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 354,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                lineNumber: 352,
                                columnNumber: 15
                            }, this),
                            (breakdown.platformFeeCombinedCents ?? breakdown.platformFeeCents ?? 0) > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white/60",
                                        children: "Taxa da plataforma"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 359,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-orange-200",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(platformFeeEur)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 360,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                lineNumber: 358,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between border-t border-white/10 pt-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-white text-[12px] font-semibold uppercase tracking-widest",
                                        children: "Total Pago"
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 364,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xl font-semibold",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$money$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatEuro"])(totalEur)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                        lineNumber: 365,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                                lineNumber: 363,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 344,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-1 text-sm text-white/60",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: status === "PAID" ? guestEmail ? "Guarda o email com os bilhetes. Podes criar conta e ligar estes bilhetes mais tarde." : "A tua compra foi concluída com sucesso." : status === "FAILED" ? `O pagamento não ficou confirmado. Se o teu banco debitou, contacta suporte${purchaseId ? ` com o ID de compra: ${purchaseId}` : ""}.` : "Estamos a confirmar o pagamento. Se demorares mais de alguns minutos, fecha e volta a abrir o checkout."
                        }, void 0, false, {
                            fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                            lineNumber: 374,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 373,
                        columnNumber: 9
                    }, this),
                    status === "PAID" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>guestEmail ? router.push("/login") : router.push("/me"),
                        className: "w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black py-3 text-sm font-semibold shadow-[0_0_30px_rgba(107,255,255,0.55)] hover:scale-[1.03] active:scale-95 transition-transform",
                        children: guestEmail ? "Criar conta e ligar bilhetes" : "Ver os teus bilhetes"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 387,
                        columnNumber: 11
                    }, this) : status === "FAILED" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-full rounded-2xl border border-red-500/40 bg-red-500/10 text-sm text-red-100 py-3 text-center",
                        children: "Pagamento não confirmado. Verifica o método de pagamento ou tenta novamente."
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 394,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-full rounded-full border border-white/15 bg-white/10 text-white text-sm font-semibold py-3 text-center",
                        children: "A confirmar…"
                    }, void 0, false, {
                        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                        lineNumber: 398,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                lineNumber: 329,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: fecharCheckout,
                className: "w-full rounded-full border border-white/15 bg-white/10 text-white font-semibold py-2.5 text-sm shadow-[0_14px_30px_rgba(0,0,0,0.45)] hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition",
                children: "Fechar"
            }, void 0, false, {
                fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
                lineNumber: 405,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/checkout/Step3Sucesso.tsx",
        lineNumber: 292,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/components/checkout/ModalCheckout.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ModalCheckout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$Step1Bilhete$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/Step1Bilhete.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$Step2Pagamento$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/Step2Pagamento.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$Step3Sucesso$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/Step3Sucesso.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
function ModalCheckout() {
    const { isOpen, passo, fecharCheckout, irParaPasso } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return ()=>{
            document.body.style.overflow = "";
        };
    }, [
        isOpen
    ]);
    // 🔥 Escutar evento vindo do WavesSectionClient e forçar passo 1
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        function forceStep1() {
            irParaPasso(1);
        }
        window.addEventListener("ORYA_CHECKOUT_FORCE_STEP1", forceStep1);
        return ()=>window.removeEventListener("ORYA_CHECKOUT_FORCE_STEP1", forceStep1);
    }, [
        irParaPasso
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AnimatePresence"], {
        children: isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["motion"].div, {
                    className: "fixed inset-0 z-[200] bg-gradient-to-br from-[#040712]/90 via-[#050918]/85 to-[#02040c]/90 backdrop-blur-3xl",
                    initial: {
                        opacity: 0
                    },
                    animate: {
                        opacity: 1
                    },
                    exit: {
                        opacity: 0
                    },
                    onClick: fecharCheckout
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                    lineNumber: 43,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["motion"].div, {
                    className: "fixed inset-0 z-[210] flex items-center justify-center p-4 overflow-hidden",
                    initial: {
                        opacity: 0,
                        y: 40
                    },
                    animate: {
                        opacity: 1,
                        y: 0
                    },
                    exit: {
                        opacity: 0,
                        y: 30
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative w-full max-w-3xl max-h-[88vh] rounded-3xl border border-white/12 bg-white/[0.08] backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.6)] text-white overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,0,200,0.35),_transparent_60%)] blur-2xl"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                lineNumber: 60,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "pointer-events-none absolute -right-24 -bottom-32 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(107,255,255,0.32),_transparent_60%)] blur-2xl"
                            }, void 0, false, {
                                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                lineNumber: 61,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl",
                                        children: [
                                            passo > 1 && passo !== 3 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>irParaPasso(Math.max(1, passo - 1)),
                                                className: "text-[12px] inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75 hover:text-white hover:border-white/30 transition",
                                                children: "← Voltar"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                                lineNumber: 65,
                                                columnNumber: 21
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[12px] text-white/60",
                                                children: passo === 3 ? "Pagamento concluído" : "Checkout"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                                lineNumber: 73,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: fecharCheckout,
                                                className: "h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/85 hover:bg-white/20 transition",
                                                "aria-label": "Fechar checkout",
                                                children: "×"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                                lineNumber: 77,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                        lineNumber: 63,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "p-6 overflow-y-auto max-h-[78vh] bg-gradient-to-b from-white/[0.03] via-transparent to-white/[0.02]",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StepController, {}, void 0, false, {
                                            fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                            lineNumber: 87,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                        lineNumber: 86,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                                lineNumber: 62,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                        lineNumber: 58,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                    lineNumber: 52,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true)
    }, void 0, false, {
        fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, this);
}
function StepController() {
    const { passo, irParaPasso } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        function handler() {
            irParaPasso(1);
        }
        window.addEventListener("ORYA_CHECKOUT_FORCE_STEP1", handler);
        return ()=>window.removeEventListener("ORYA_CHECKOUT_FORCE_STEP1", handler);
    }, [
        irParaPasso
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            passo === 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$Step1Bilhete$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                lineNumber: 111,
                columnNumber: 23
            }, this),
            passo === 2 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$Step2Pagamento$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                lineNumber: 112,
                columnNumber: 23
            }, this),
            passo === 3 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$Step3Sucesso$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/app/components/checkout/ModalCheckout.tsx",
                lineNumber: 113,
                columnNumber: 23
            }, this)
        ]
    }, void 0, true);
}
}),
"[project]/app/eventos/[slug]/EventPageClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EventPageClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$ModalCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/ModalCheckout.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/checkout/contextoCheckout.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
function EventPageClient({ slug, uiTickets, checkoutUiVariant, padelMeta, defaultPadelTicketId }) {
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const { abrirCheckout, atualizarDados, irParaPasso } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$contextoCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCheckout"])();
    const inviteHandledRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const checkoutHandledRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const inviteToken = searchParams.get("inviteToken");
    const fallbackWaves = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (uiTickets && uiTickets.length > 0) return uiTickets;
        return [];
    }, [
        uiTickets
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const wantsCheckout = searchParams.get("checkout");
        if (!wantsCheckout || checkoutHandledRef.current) return;
        const visibleTickets = fallbackWaves.filter((ticket)=>ticket.isVisible);
        const purchasableTickets = visibleTickets.filter((ticket)=>ticket.status === "on_sale" || ticket.status === "upcoming");
        const preferredTicket = typeof defaultPadelTicketId === "number" ? visibleTickets.find((ticket)=>Number(ticket.id) === defaultPadelTicketId) : null;
        const selectedTicket = preferredTicket ?? purchasableTickets[0] ?? visibleTickets[0];
        if (!selectedTicket) return;
        checkoutHandledRef.current = true;
        atualizarDados({
            slug,
            waves: visibleTickets,
            additional: {
                checkoutUiVariant,
                padelMeta
            }
        });
        abrirCheckout({
            slug,
            ticketId: selectedTicket.id,
            price: selectedTicket.price,
            ticketName: selectedTicket.name,
            eventId: padelMeta?.eventId ? String(padelMeta.eventId) : undefined,
            waves: visibleTickets,
            additional: {
                checkoutUiVariant,
                padelMeta
            }
        });
        setTimeout(()=>{
            try {
                const evt = new Event("ORYA_CHECKOUT_FORCE_STEP1");
                window.dispatchEvent(evt);
            } catch  {}
        }, 30);
    }, [
        abrirCheckout,
        atualizarDados,
        checkoutUiVariant,
        defaultPadelTicketId,
        fallbackWaves,
        padelMeta,
        searchParams,
        slug
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!inviteToken) return;
        if (inviteHandledRef.current === inviteToken) return;
        inviteHandledRef.current = inviteToken;
        let cancelled = false;
        const handleInvite = async ()=>{
            try {
                const res = await fetch(`/api/padel/pairings/claim/${encodeURIComponent(inviteToken)}`);
                const json = await res.json().catch(()=>null);
                if (!res.ok || !json?.ok || !json?.pairing?.id) {
                    throw new Error(json?.error || "Convite inválido.");
                }
                if (cancelled) return;
                const pairing = json.pairing;
                const pairingMode = pairing.paymentMode === "FULL" ? "GROUP_FULL" : "GROUP_SPLIT";
                const pendingSlot = pairing.slots.find((s)=>s.slotStatus === "PENDING" || s.paymentStatus === "UNPAID") ?? pairing.slots[0];
                if (!pendingSlot) {
                    throw new Error("Não foi possível identificar o slot da dupla.");
                }
                const ticketTypes = Array.isArray(json.ticketTypes) ? json.ticketTypes : [];
                const preferredTicketId = typeof defaultPadelTicketId === "number" && ticketTypes.some((t)=>t.id === defaultPadelTicketId) ? defaultPadelTicketId : ticketTypes.length > 0 ? ticketTypes[0].id : null;
                const fallbackTicket = typeof preferredTicketId === "number" ? ticketTypes.find((t)=>t.id === preferredTicketId) ?? ticketTypes[0] : ticketTypes[0];
                const ticketFromWaves = typeof preferredTicketId === "number" ? fallbackWaves.find((w)=>Number(w.id) === preferredTicketId) : null;
                const ticketId = ticketFromWaves ? Number(ticketFromWaves.id) : fallbackTicket?.id ?? null;
                if (!ticketId) {
                    throw new Error("Bilhete inválido para este convite.");
                }
                const unitPrice = ticketFromWaves?.price ?? (typeof fallbackTicket?.price === "number" ? fallbackTicket.price : 0);
                const ticketName = ticketFromWaves?.name ?? (fallbackTicket?.name || "Bilhete Padel");
                const waves = fallbackWaves.length > 0 ? fallbackWaves : ticketTypes.map((t)=>({
                        id: String(t.id),
                        name: t.name ?? "Bilhete",
                        price: t.price ?? 0,
                        currency: t.currency ?? "EUR",
                        remaining: null,
                        status: "on_sale",
                        startsAt: null,
                        endsAt: null,
                        available: true,
                        isVisible: true
                    }));
                const quantity = pairingMode === "GROUP_FULL" ? 2 : 1;
                const total = unitPrice * quantity;
                const pairingCategoryId = typeof json?.pairing?.categoryId === "number" ? json.pairing.categoryId : null;
                const metaFromInvite = {
                    eventId: pairing.eventId,
                    organizerId: json.organizerId ?? null,
                    categoryId: pairingCategoryId,
                    categoryLinkId: ticketFromWaves?.padelCategoryLinkId ?? null
                };
                if (pendingSlot.paymentStatus === "PAID") {
                    const claimRes = await fetch(`/api/padel/pairings/claim/${encodeURIComponent(inviteToken)}`, {
                        method: "POST"
                    });
                    const claimJson = await claimRes.json().catch(()=>null);
                    if (!claimRes.ok || !claimJson?.ok) {
                        throw new Error(claimJson?.error || "Não foi possível aceitar o convite.");
                    }
                    alert("Convite aceite. Já estás inscrito.");
                    return;
                }
                const additional = {
                    checkoutUiVariant,
                    padelMeta: metaFromInvite,
                    pairingId: pairing.id,
                    pairingSlotId: pendingSlot.id,
                    ticketTypeId: ticketId,
                    inviteToken,
                    quantidades: {
                        [ticketId]: quantity
                    },
                    total
                };
                abrirCheckout({
                    slug,
                    ticketId: String(ticketId),
                    price: unitPrice,
                    ticketName,
                    eventId: String(pairing.eventId),
                    waves,
                    additional,
                    pairingId: pairing.id,
                    pairingSlotId: pendingSlot.id,
                    ticketTypeId: ticketId
                });
                atualizarDados({
                    paymentScenario: pairingMode,
                    additional
                });
                irParaPasso(2);
            } catch (err) {
                console.error("[EventPageClient] convite padel", err);
                alert(err instanceof Error ? err.message : "Erro ao processar o convite.");
            }
        };
        void handleInvite();
        return ()=>{
            cancelled = true;
        };
    }, [
        abrirCheckout,
        atualizarDados,
        checkoutUiVariant,
        defaultPadelTicketId,
        fallbackWaves,
        inviteToken,
        irParaPasso,
        padelMeta,
        slug
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$checkout$2f$ModalCheckout$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
        fileName: "[project]/app/eventos/[slug]/EventPageClient.tsx",
        lineNumber: 273,
        columnNumber: 10
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
"[project]/app/eventos/[slug]/EventBackgroundTuner.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EventBackgroundTuner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
"use client";
;
;
;
const NEBULA_PRESET = {
    blur: 72,
    scale: 1.34,
    saturate: 1.4,
    brightness: 1.08,
    maskStops: [
        0,
        22,
        44,
        66,
        86,
        100
    ],
    maskAlphas: [
        1,
        0.96,
        0.78,
        0.46,
        0.2,
        0
    ],
    overlayTop: 0.32,
    overlayMid: 0.2,
    overlayBottom: 0.08,
    fadeStart: 84,
    fadeMid: 94,
    fadeEnd: 100,
    fadeDark: 0.86
};
const AURORA_PRESET = {
    blur: 62,
    scale: 1.3,
    saturate: 1.5,
    brightness: 1.12,
    maskStops: [
        0,
        24,
        46,
        68,
        88,
        100
    ],
    maskAlphas: [
        1,
        0.96,
        0.78,
        0.5,
        0.22,
        0
    ],
    overlayTop: 0.28,
    overlayMid: 0.16,
    overlayBottom: 0.04,
    fadeStart: 80,
    fadeMid: 92,
    fadeEnd: 100,
    fadeDark: 0.78
};
const OBSIDIAN_PRESET = {
    blur: 58,
    scale: 1.22,
    saturate: 0.75,
    brightness: 0.9,
    maskStops: [
        0,
        18,
        36,
        56,
        78,
        100
    ],
    maskAlphas: [
        1,
        0.98,
        0.82,
        0.55,
        0.28,
        0
    ],
    overlayTop: 0.72,
    overlayMid: 0.55,
    overlayBottom: 0.28,
    fadeStart: 54,
    fadeMid: 72,
    fadeEnd: 90,
    fadeDark: 0.96
};
const EMBER_PRESET = {
    blur: 52,
    scale: 1.2,
    saturate: 1.4,
    brightness: 1.18,
    maskStops: [
        0,
        26,
        50,
        70,
        88,
        100
    ],
    maskAlphas: [
        1,
        0.95,
        0.75,
        0.45,
        0.2,
        0
    ],
    overlayTop: 0.32,
    overlayMid: 0.2,
    overlayBottom: 0.06,
    fadeStart: 78,
    fadeMid: 90,
    fadeEnd: 98,
    fadeDark: 0.72
};
const SAPPHIRE_PRESET = {
    blur: 78,
    scale: 1.34,
    saturate: 1.15,
    brightness: 1.08,
    maskStops: [
        0,
        30,
        54,
        74,
        90,
        100
    ],
    maskAlphas: [
        1,
        0.98,
        0.85,
        0.55,
        0.25,
        0
    ],
    overlayTop: 0.24,
    overlayMid: 0.14,
    overlayBottom: 0.04,
    fadeStart: 86,
    fadeMid: 95,
    fadeEnd: 100,
    fadeDark: 0.7
};
const ROSE_PRESET = {
    blur: 66,
    scale: 1.26,
    saturate: 1.22,
    brightness: 1.04,
    maskStops: [
        0,
        22,
        44,
        64,
        84,
        100
    ],
    maskAlphas: [
        1,
        0.96,
        0.8,
        0.5,
        0.22,
        0
    ],
    overlayTop: 0.36,
    overlayMid: 0.22,
    overlayBottom: 0.08,
    fadeStart: 82,
    fadeMid: 93,
    fadeEnd: 100,
    fadeDark: 0.8
};
const PRESET_OPTIONS = [
    {
        key: "nebula",
        label: "Nebula Drift"
    },
    {
        key: "aurora",
        label: "Aurora Veil"
    },
    {
        key: "obsidian",
        label: "Obsidian Luxe"
    },
    {
        key: "ember",
        label: "Ember Horizon"
    },
    {
        key: "sapphire",
        label: "Sapphire Mist"
    },
    {
        key: "rose",
        label: "Rose Quartz"
    }
];
function EventBackgroundTuner({ targetId, defaults }) {
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const enabled = searchParams?.get("bgtools") === "1";
    const [activePreset, setActivePreset] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("nebula");
    const activeValues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (activePreset === "nebula") return NEBULA_PRESET;
        if (activePreset === "aurora") return AURORA_PRESET;
        if (activePreset === "obsidian") return OBSIDIAN_PRESET;
        if (activePreset === "ember") return EMBER_PRESET;
        if (activePreset === "sapphire") return SAPPHIRE_PRESET;
        if (activePreset === "rose") return ROSE_PRESET;
        return defaults;
    }, [
        activePreset,
        defaults
    ]);
    const cssVars = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            "--event-bg-blur": `${activeValues.blur}px`,
            "--event-bg-scale": `${activeValues.scale}`,
            "--event-bg-saturate": `${activeValues.saturate}`,
            "--event-bg-brightness": `${activeValues.brightness}`,
            "--event-bg-mask-stop-1": `${activeValues.maskStops[0]}%`,
            "--event-bg-mask-stop-2": `${activeValues.maskStops[1]}%`,
            "--event-bg-mask-stop-3": `${activeValues.maskStops[2]}%`,
            "--event-bg-mask-stop-4": `${activeValues.maskStops[3]}%`,
            "--event-bg-mask-stop-5": `${activeValues.maskStops[4]}%`,
            "--event-bg-mask-stop-6": `${activeValues.maskStops[5]}%`,
            "--event-bg-mask-alpha-1": `${activeValues.maskAlphas[0]}`,
            "--event-bg-mask-alpha-2": `${activeValues.maskAlphas[1]}`,
            "--event-bg-mask-alpha-3": `${activeValues.maskAlphas[2]}`,
            "--event-bg-mask-alpha-4": `${activeValues.maskAlphas[3]}`,
            "--event-bg-mask-alpha-5": `${activeValues.maskAlphas[4]}`,
            "--event-bg-mask-alpha-6": `${activeValues.maskAlphas[5]}`,
            "--event-bg-overlay-top": `${activeValues.overlayTop}`,
            "--event-bg-overlay-mid": `${activeValues.overlayMid}`,
            "--event-bg-overlay-bottom": `${activeValues.overlayBottom}`,
            "--event-bg-fade-start": `${activeValues.fadeStart}%`,
            "--event-bg-fade-mid": `${activeValues.fadeMid}%`,
            "--event-bg-fade-end": `${activeValues.fadeEnd}%`,
            "--event-bg-fade-dark": `${activeValues.fadeDark}`
        }), [
        activeValues
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const target = document.getElementById(targetId);
        if (!target) return;
        Object.entries(cssVars).forEach(([key, value])=>{
            target.style.setProperty(key, value);
        });
    }, [
        targetId,
        cssVars
    ]);
    if (!enabled) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed bottom-4 left-4 z-[60] w-[260px] rounded-2xl border border-white/15 bg-black/70 p-4 text-white shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[10px] uppercase tracking-[0.2em] text-white/50",
                children: "Background presets"
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventBackgroundTuner.tsx",
                lineNumber: 199,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm font-semibold",
                children: "Evento"
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventBackgroundTuner.tsx",
                lineNumber: 202,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 grid gap-2",
                children: PRESET_OPTIONS.map((preset)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setActivePreset(preset.key),
                        className: `rounded-xl border px-3 py-2 text-left text-[12px] font-semibold transition ${activePreset === preset.key ? "border-white/40 bg-white/15 text-white shadow-[0_0_20px_rgba(255,255,255,0.12)]" : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"}`,
                        children: preset.label
                    }, preset.key, false, {
                        fileName: "[project]/app/eventos/[slug]/EventBackgroundTuner.tsx",
                        lineNumber: 205,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/EventBackgroundTuner.tsx",
                lineNumber: 203,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/EventBackgroundTuner.tsx",
        lineNumber: 198,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/eventos/[slug]/InviteGateClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>InviteGateClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/eventos/[slug]/WavesSectionClient.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function InviteGateClient({ slug, isFree, isAuthenticated, hasUsername, userEmailNormalized, usernameNormalized, uiTickets, checkoutUiVariant, padelMeta }) {
    const [identifier, setIdentifier] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [inviteType, setInviteType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [inviteNormalized, setInviteNormalized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [validated, setValidated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const handleCheck = async ()=>{
        const trimmed = identifier.trim();
        if (!trimmed) {
            setError("Indica o email ou @username do convite.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/eventos/${encodeURIComponent(slug)}/invites/check`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    identifier: trimmed,
                    scope: "PUBLIC"
                })
            });
            const json = await res.json().catch(()=>null);
            if (!res.ok || !json?.ok) {
                throw new Error(json?.error || "Não foi possível validar o convite.");
            }
            if (!json.invited) {
                setValidated(false);
                setInviteType(null);
                setInviteNormalized(null);
                setError("Sem convite válido para este evento.");
                return;
            }
            const type = json.type === "username" ? "username" : "email";
            setInviteType(type);
            setValidated(true);
            setInviteNormalized(json.normalized ?? trimmed);
        } catch (err) {
            setValidated(false);
            setInviteType(null);
            setInviteNormalized(null);
            setError(err instanceof Error ? err.message : "Não foi possível validar o convite.");
        } finally{
            setLoading(false);
        }
    };
    const inviteMatchesAccount = validated && isAuthenticated && (inviteType === "email" && inviteNormalized && userEmailNormalized && inviteNormalized === userEmailNormalized || inviteType === "username" && inviteNormalized && usernameNormalized && inviteNormalized === usernameNormalized);
    const paidInviteMatches = inviteMatchesAccount && !isFree;
    const freeInviteMatches = inviteMatchesAccount && isFree && hasUsername;
    const gateMessage = (()=>{
        if (!validated) return null;
        if (!isAuthenticated) {
            return "Convite validado. Inicia sessão com a conta convidada para continuar.";
        }
        if (inviteType === "email") {
            if (!inviteNormalized || !userEmailNormalized || inviteNormalized !== userEmailNormalized) {
                return "Este convite não corresponde ao email desta conta.";
            }
            if (isFree && !hasUsername) {
                return "Define um username na tua conta para concluir a inscrição gratuita.";
            }
            return isFree ? "Convite validado. Podes continuar a inscrição gratuita." : "Convite validado. Podes continuar o checkout.";
        }
        if (inviteType === "username") {
            if (!hasUsername) {
                return "Define um username na tua conta para continuar.";
            }
            if (!inviteNormalized || !usernameNormalized || inviteNormalized !== usernameNormalized) {
                return "Este convite não corresponde ao teu username.";
            }
            return isFree ? "Convite validado. Podes continuar a inscrição gratuita." : "Convite validado. Podes continuar o checkout.";
        }
        return null;
    })();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(6,10,24,0.9))] px-4 py-4 text-sm text-white/85 shadow-[0_18px_45px_rgba(0,0,0,0.55)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Acesso exclusivo"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                                lineNumber: 138,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "h-1 w-1 rounded-full bg-white/30"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                                lineNumber: 139,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Convites ORYA"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                                lineNumber: 140,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 137,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-base font-semibold text-white",
                        children: "Este evento é apenas por convite."
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] text-white/65",
                        children: "Só convidados podem ver o checkout. Valida o teu convite para desbloquear o acesso."
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 143,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                lineNumber: 136,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-2xl border border-white/12 bg-black/50 px-4 py-4 text-sm text-white/80",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                        children: "Tenho convite"
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 149,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-2 flex flex-col gap-2 sm:flex-row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                value: identifier,
                                onChange: (e)=>setIdentifier(e.target.value),
                                placeholder: "Email do convite ou @username",
                                className: "w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/60"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                                lineNumber: 153,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: handleCheck,
                                disabled: loading,
                                className: "rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-60",
                                children: loading ? "A validar…" : "Validar"
                            }, void 0, false, {
                                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                                lineNumber: 159,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 152,
                        columnNumber: 9
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-[12px] font-semibold text-amber-100",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 168,
                        columnNumber: 19
                    }, this),
                    gateMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-[12px] text-amber-100",
                        children: gateMessage
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 170,
                        columnNumber: 25
                    }, this),
                    !validated && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-[12px] text-white/60",
                        children: isAuthenticated ? "Se não tiveres convite, não consegues continuar." : "Sem convite válido não consegues aceder ao evento."
                    }, void 0, false, {
                        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                        lineNumber: 172,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                lineNumber: 148,
                columnNumber: 7
            }, this),
            paidInviteMatches && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                slug: slug,
                tickets: uiTickets,
                checkoutUiVariant: checkoutUiVariant,
                padelMeta: padelMeta,
                inviteEmail: inviteType === "email" ? inviteNormalized ?? undefined : undefined
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                lineNumber: 181,
                columnNumber: 9
            }, this),
            freeInviteMatches && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$eventos$2f5b$slug$5d2f$WavesSectionClient$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                slug: slug,
                tickets: uiTickets,
                isFreeEvent: true,
                checkoutUiVariant: checkoutUiVariant,
                padelMeta: padelMeta
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                lineNumber: 191,
                columnNumber: 9
            }, this),
            !validated && identifier.trim() && EMAIL_REGEX.test(identifier.trim()) && !isFree && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-xl border border-white/12 bg-black/50 px-3.5 py-2.5 text-[11px] text-white/65",
                children: "Usa o mesmo email na tua conta para desbloquear o convite."
            }, void 0, false, {
                fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
                lineNumber: 201,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/eventos/[slug]/InviteGateClient.tsx",
        lineNumber: 135,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=_8b2e75ae._.js.map