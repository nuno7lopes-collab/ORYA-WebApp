module.exports = [
"[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PadelTournamentTabs
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/swr/dist/index/index.mjs [app-ssr] (ecmascript) <locals>");
"use client";
;
;
;
const fetcher = (url)=>fetch(url).then((r)=>r.json());
function nameFromSlots(pairing) {
    if (!pairing) return "—";
    const names = pairing.slots.map((s)=>s.playerProfile?.displayName || s.playerProfile?.fullName).filter(Boolean);
    return names.length ? names.join(" / ") : "Dupla incompleta";
}
function PadelTournamentTabs({ eventId, categoriesMeta }) {
    const [tab, setTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("duplas");
    const [configMessage, setConfigMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const categoryOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>(categoriesMeta || []).filter((c)=>Number.isFinite(c.categoryId)).map((c)=>({
                id: c.categoryId,
                label: c.name || `Categoria ${c.categoryId}`
            })), [
        categoriesMeta
    ]);
    const [selectedCategoryId, setSelectedCategoryId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (categoryOptions.length === 0) {
            if (selectedCategoryId !== null) setSelectedCategoryId(null);
            return;
        }
        if (selectedCategoryId && categoryOptions.some((c)=>c.id === selectedCategoryId)) return;
        setSelectedCategoryId(categoryOptions[0].id ?? null);
    }, [
        categoryOptions,
        selectedCategoryId
    ]);
    const { data: pairingsRes } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(eventId ? `/api/padel/pairings?eventId=${eventId}` : null, fetcher);
    const categoryParam = selectedCategoryId ? `&categoryId=${selectedCategoryId}` : "";
    const { data: matchesRes, mutate: mutateMatches } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(eventId ? `/api/padel/matches?eventId=${eventId}${categoryParam}` : null, fetcher);
    const { data: standingsRes } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(eventId ? `/api/padel/standings?eventId=${eventId}${categoryParam}` : null, fetcher);
    const { data: configRes, mutate: mutateConfig } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$swr$2f$dist$2f$index$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(eventId ? `/api/padel/tournaments/config?eventId=${eventId}` : null, fetcher);
    const pairings = pairingsRes?.pairings ?? [];
    const matches = matchesRes?.items ?? [];
    const standings = standingsRes?.standings ?? {};
    const advanced = configRes?.config?.advancedSettings || {};
    const formatRequested = advanced.formatRequested;
    const formatEffective = advanced.formatEffective;
    const generationVersion = advanced.generationVersion;
    const koGeneratedAt = advanced.koGeneratedAt;
    const koSeedSnapshot = advanced.koSeedSnapshot ?? [];
    const koOverride = advanced.koOverride === true;
    const pairingNameById = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const map = new Map();
        pairings.forEach((p)=>map.set(p.id, nameFromSlots(p)));
        return map;
    }, [
        pairings
    ]);
    const filteredPairings = selectedCategoryId ? pairings.filter((p)=>p.categoryId === selectedCategoryId) : pairings;
    const koRounds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const winnerFromSets = (sets)=>{
            if (!sets || sets.length === 0) return null;
            let winsA = 0;
            let winsB = 0;
            sets.forEach((s)=>{
                if (Number.isFinite(s.teamA) && Number.isFinite(s.teamB)) {
                    if (s.teamA > s.teamB) winsA += 1;
                    else if (s.teamB > s.teamA) winsB += 1;
                }
            });
            if (winsA === winsB) return null;
            return winsA > winsB ? "A" : "B";
        };
        const rounds = new Map();
        matches.filter((m)=>m.roundType === "KNOCKOUT").forEach((m)=>{
            const key = m.roundLabel || "KO";
            if (!rounds.has(key)) rounds.set(key, []);
            const score = m.scoreSets?.length && m.scoreSets.length > 0 ? m.scoreSets.map((s)=>`${s.teamA}-${s.teamB}`).join(", ") : "—";
            rounds.get(key).push({
                id: m.id,
                teamA: pairingNameById.get(m.pairingA?.id ?? 0) ?? "—",
                teamB: m.pairingB ? pairingNameById.get(m.pairingB?.id ?? 0) ?? "—" : "BYE",
                status: m.status,
                score,
                winner: winnerFromSets(m.scoreSets ?? undefined)
            });
        });
        // ordenar rounds por importância
        const order = [
            "R16",
            "QUARTERFINAL",
            "SEMIFINAL",
            "FINAL"
        ];
        return Array.from(rounds.entries()).sort((a, b)=>{
            const ai = order.indexOf(a[0]);
            const bi = order.indexOf(b[0]);
            if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });
    }, [
        matches,
        pairingNameById
    ]);
    const categoryStats = (()=>{
        const metaMap = new Map();
        (categoriesMeta || []).forEach((m)=>{
            const key = Number.isFinite(m.categoryId) ? m.categoryId : null;
            metaMap.set(key, m);
        });
        const counts = new Map();
        pairings.forEach((p)=>{
            const key = Number.isFinite(p.categoryId) ? p.categoryId : null;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        const rows = [];
        const keys = new Set([
            ...counts.keys(),
            ...metaMap.keys()
        ]);
        keys.forEach((key)=>{
            const meta = metaMap.get(key);
            const label = meta?.name || (key === null ? "Categoria" : `Categoria ${key}`);
            const capacity = meta?.capacity ?? null;
            rows.push({
                key,
                label,
                count: counts.get(key) || 0,
                capacity
            });
        });
        return rows;
    })();
    const matchesSummary = {
        pending: matches.filter((m)=>m.status === "PENDING").length,
        live: matches.filter((m)=>m.status === "IN_PROGRESS" || m.status === "LIVE").length,
        done: matches.filter((m)=>m.status === "DONE").length
    };
    const groupMatchesCount = matches.filter((m)=>m.roundType === "GROUPS").length;
    const groupMatchesDone = matches.filter((m)=>m.roundType === "GROUPS" && m.status === "DONE").length;
    const groupMissing = Math.max(0, groupMatchesCount - groupMatchesDone);
    const groupsConfig = advanced.groupsConfig || {};
    const formatLabel = (value)=>{
        if (!value) return "";
        switch(value){
            case "QUADRO_ELIMINATORIO":
                return "KO";
            case "GRUPOS_ELIMINATORIAS":
                return "Grupos + KO";
            case "TODOS_CONTRA_TODOS":
            case "CAMPEONATO_LIGA":
                return "Liga";
            case "QUADRO_AB":
                return "Quadro A/B (legacy)";
            case "NON_STOP":
                return "Non-stop (legacy)";
            default:
                return value;
        }
    };
    const formatDate = (value)=>{
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString("pt-PT");
    };
    const championName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const finalRound = koRounds.find(([key])=>key === "FINAL") || koRounds[koRounds.length - 1];
        if (!finalRound) return null;
        const [, games] = finalRound;
        const final = games[0];
        if (!final) return null;
        if (final.winner === "A") return final.teamA;
        if (final.winner === "B") return final.teamB;
        return null;
    }, [
        koRounds
    ]);
    async function saveGroupsConfig(update) {
        const organizerId = configRes?.config?.organizerId;
        const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
        if (!organizerId || !eventId) return;
        setConfigMessage(null);
        const res = await fetch(`/api/padel/tournaments/config`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                organizerId,
                eventId,
                format,
                groups: {
                    ...groupsConfig,
                    ...update
                }
            })
        });
        if (res.ok) {
            setConfigMessage("Configuração guardada.");
            mutateConfig();
            setTimeout(()=>setConfigMessage(null), 2000);
        } else {
            setConfigMessage("Erro ao guardar configuração.");
            setTimeout(()=>setConfigMessage(null), 2500);
        }
    }
    const handleNumberConfig = (e, key)=>{
        const val = Number(e.target.value);
        if (!Number.isFinite(val) || val <= 0) {
            e.target.value = "";
            return;
        }
        saveGroupsConfig({
            [key]: val
        });
    };
    async function submitResult(matchId, scoreText) {
        const sets = scoreText.split(",").map((p)=>p.trim()).filter(Boolean).map((s)=>s.split("-").map((v)=>Number(v.trim()))).filter((arr)=>arr.length === 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1])).map(([a, b])=>({
                teamA: a,
                teamB: b
            }));
        await fetch(`/api/padel/matches`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: matchId,
                status: "DONE",
                score: {
                    sets
                }
            })
        });
        mutateMatches();
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4 mt-6",
        children: [
            categoryOptions.length > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "uppercase tracking-[0.18em] text-[11px] text-white/60",
                        children: "Categoria ativa"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 297,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        value: selectedCategoryId ?? "",
                        onChange: (e)=>setSelectedCategoryId(e.target.value ? Number(e.target.value) : null),
                        className: "rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[12px] text-white/80",
                        children: categoryOptions.map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: String(opt.id),
                                children: opt.label
                            }, `padel-cat-${opt.id}`, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 304,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 298,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 296,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid gap-3 md:grid-cols-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-white/10 bg-white/5 p-3 space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.16em] text-white/60",
                                children: "Inscrições Padel"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 314,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-2xl font-semibold text-white",
                                children: pairings.length
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 315,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/70",
                                children: [
                                    "Completas: ",
                                    pairings.filter((p)=>p.pairingStatus === "COMPLETE").length,
                                    " · Pendentes:",
                                    " ",
                                    pairings.filter((p)=>p.pairingStatus !== "COMPLETE").length
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 316,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 313,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-white/10 bg-white/5 p-3 space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.16em] text-white/60",
                                children: "Jogos"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 322,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-2xl font-semibold text-white",
                                children: matches.length
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 323,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[12px] text-white/70",
                                children: [
                                    "Pendentes ",
                                    matchesSummary.pending,
                                    " · Live ",
                                    matchesSummary.live,
                                    " · Terminados ",
                                    matchesSummary.done
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 324,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 321,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-white/10 bg-white/5 p-3 space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[11px] uppercase tracking-[0.16em] text-white/60",
                                children: "Categorias"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 329,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1 text-[12px] text-white/75",
                                children: [
                                    categoryStats.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-white/60",
                                        children: "Sem categorias definidas."
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 331,
                                        columnNumber: 44
                                    }, this),
                                    categoryStats.map((c)=>{
                                        const occupancy = c.capacity ? Math.min(100, Math.round(c.count / c.capacity * 100)) : null;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-white",
                                                    children: c.label
                                                }, void 0, false, {
                                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                    lineNumber: 336,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-white/70",
                                                    children: [
                                                        c.count,
                                                        " equipa",
                                                        c.count === 1 ? "" : "s",
                                                        " ",
                                                        c.capacity ? `· ${occupancy}%` : ""
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                    lineNumber: 337,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, `${c.key ?? "default"}`, true, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 335,
                                            columnNumber: 17
                                        }, this);
                                    })
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 330,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 328,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 312,
                columnNumber: 7
            }, this),
            formatRequested && formatEffective && formatRequested !== formatEffective && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[12px] text-amber-50",
                children: [
                    "Formato pedido: ",
                    formatLabel(formatRequested),
                    ". Este torneio está a usar: ",
                    formatLabel(formatEffective),
                    " (modo Beta)."
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 348,
                columnNumber: 9
            }, this),
            (generationVersion || groupMissing > 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 flex items-center justify-between gap-3 flex-wrap",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Motor de geração: ",
                            generationVersion ?? "v1-groups-ko"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 355,
                        columnNumber: 11
                    }, this),
                    groupMissing > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-full bg-amber-500/15 px-3 py-1 text-amber-100",
                        children: [
                            "Faltam ",
                            groupMissing,
                            " jogo",
                            groupMissing === 1 ? "" : "s",
                            " dos grupos para fechar classificação."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 357,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 354,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 text-[12px]",
                children: [
                    {
                        key: "duplas",
                        label: "Duplas"
                    },
                    {
                        key: "grupos",
                        label: "Grupos"
                    },
                    {
                        key: "eliminatorias",
                        label: "Eliminatórias"
                    },
                    {
                        key: "rankings",
                        label: "Rankings"
                    }
                ].map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setTab(t.key),
                        className: `rounded-full px-3 py-1 border ${tab === t.key ? "bg-white text-black font-semibold" : "border-white/20 text-white/75"}`,
                        children: t.label
                    }, t.key, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 371,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 364,
                columnNumber: 7
            }, this),
            tab === "grupos" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                        children: "Configuração de grupos"
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 383,
                        columnNumber: 11
                    }, this),
                    configMessage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[12px] text-white/70",
                        children: configMessage
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 384,
                        columnNumber: 29
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-2 sm:grid-cols-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "flex flex-col gap-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[11px] text-white/60",
                                        children: "Nº de grupos"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 387,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "number",
                                        min: 1,
                                        defaultValue: groupsConfig.groupCount ?? "",
                                        className: "rounded-lg border border-white/15 bg-black/30 px-2 py-1",
                                        onBlur: (e)=>handleNumberConfig(e, "groupCount")
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 388,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 386,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "flex flex-col gap-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[11px] text-white/60",
                                        children: "Passam por grupo"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 397,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "number",
                                        min: 1,
                                        defaultValue: groupsConfig.qualifyPerGroup ?? 2,
                                        className: "rounded-lg border border-white/15 bg-black/30 px-2 py-1",
                                        onBlur: (e)=>handleNumberConfig(e, "qualifyPerGroup")
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 398,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 396,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "flex flex-col gap-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[11px] text-white/60",
                                        children: "Seeding"
                                    }, void 0, false, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 407,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        defaultValue: groupsConfig.seeding ?? "SNAKE",
                                        className: "rounded-lg border border-white/15 bg-black/30 px-2 py-1",
                                        onChange: (e)=>saveGroupsConfig({
                                                seeding: e.target.value
                                            }),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "SNAKE",
                                                children: "Snake (equilibrado)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                lineNumber: 413,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "NONE",
                                                children: "Aleatório"
                                            }, void 0, false, {
                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                lineNumber: 414,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 408,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 406,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 385,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] text-white/50",
                        children: "Guardado ao sair dos campos. Valores têm de ser maiores que zero."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 418,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 382,
                columnNumber: 9
            }, this),
            tab === "duplas" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-2",
                children: [
                    filteredPairings.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-white/70",
                        children: "Ainda não há duplas."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 424,
                        columnNumber: 45
                    }, this),
                    filteredPairings.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl border border-white/15 bg-white/5 p-3 text-sm flex items-center justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "font-semibold",
                                            children: nameFromSlots(p)
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 428,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] text-white/60",
                                            children: [
                                                p.pairingStatus,
                                                " · ",
                                                p.paymentMode
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 429,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 427,
                                    columnNumber: 15
                                }, this),
                                p.inviteToken && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>navigator.clipboard.writeText(`${window.location.origin}/eventos/${eventId}?token=${p.inviteToken}`),
                                    className: "rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10",
                                    children: "Copiar convite"
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 432,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, p.id, true, {
                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                            lineNumber: 426,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 423,
                columnNumber: 9
            }, this),
            tab === "grupos" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    matches.filter((m)=>m.roundType === "GROUPS").length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-white/70",
                        children: "Sem jogos de grupos."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 449,
                        columnNumber: 76
                    }, this),
                    matches.filter((m)=>m.roundType === "GROUPS").map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-white/70",
                                                    children: [
                                                        "Grupo ",
                                                        m.groupLabel || "?"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                    lineNumber: 456,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "font-semibold",
                                                    children: [
                                                        nameFromSlots(m.pairingA),
                                                        " vs ",
                                                        nameFromSlots(m.pairingB)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                    lineNumber: 459,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 455,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[11px] text-white/60",
                                            children: m.status
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 461,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 454,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[12px] text-white/70",
                                    children: [
                                        "Resultado: ",
                                        m.scoreSets?.length ? m.scoreSets.map((s)=>`${s.teamA}-${s.teamB}`).join(", ") : "—"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 463,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 text-[12px]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            placeholder: "6-3, 6-4",
                                            className: "flex-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1",
                                            onBlur: (e)=>{
                                                const v = e.target.value.trim();
                                                if (v) submitResult(m.id, v);
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 465,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-white/50",
                                            children: "(guardar ao sair do campo)"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 474,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 464,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, m.id, true, {
                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                            lineNumber: 453,
                            columnNumber: 15
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 448,
                columnNumber: 9
            }, this),
            tab === "eliminatorias" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    koRounds.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-white/70",
                        children: "Ainda não geraste eliminatórias."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 483,
                        columnNumber: 37
                    }, this),
                    koGeneratedAt && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 space-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: [
                                    "Quadro gerado em ",
                                    formatDate(koGeneratedAt),
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 486,
                                columnNumber: 15
                            }, this),
                            koOverride && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-amber-200",
                                children: "Gerado em modo override (grupos com jogos em falta)."
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 487,
                                columnNumber: 30
                            }, this),
                            koSeedSnapshot.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1 text-white/70",
                                children: koSeedSnapshot.map((q)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    q.rank,
                                                    "º ",
                                                    q.groupLabel,
                                                    " — ",
                                                    pairingNameById.get(q.pairingId) ?? `Dupla ${q.pairingId}`
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                lineNumber: 492,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-white/50",
                                                children: [
                                                    "Pts ",
                                                    q.points ?? "—",
                                                    " · SetΔ ",
                                                    q.setDiff ?? "—",
                                                    " · GameΔ ",
                                                    q.gameDiff ?? "—"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                lineNumber: 495,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, `${q.groupLabel}-${q.rank}-${q.pairingId}`, true, {
                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                        lineNumber: 491,
                                        columnNumber: 21
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 489,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 485,
                        columnNumber: 13
                    }, this),
                    championName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-[12px] text-emerald-50 flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[11px] uppercase tracking-[0.18em] text-emerald-200",
                                children: "Vencedor"
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 506,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-sm font-semibold",
                                children: championName
                            }, void 0, false, {
                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                lineNumber: 507,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 505,
                        columnNumber: 13
                    }, this),
                    koRounds.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "overflow-x-auto",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex min-w-full gap-4 pb-2",
                            children: koRounds.map(([roundKey, games], roundIdx)=>{
                                const isLast = roundIdx === koRounds.length - 1;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative min-w-[220px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-[#0a0f1f]/60 to-[#05070f]/70 p-3 space-y-2 shadow-[0_15px_35px_rgba(0,0,0,0.35)]",
                                    children: [
                                        !isLast && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute top-3 right-[-12px] h-[90%] w-px bg-white/10 hidden lg:block"
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 520,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                                            children: roundKey
                                        }, void 0, false, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 521,
                                            columnNumber: 21
                                        }, this),
                                        games.map((g)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-xl border border-white/15 bg-black/40 p-2 space-y-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between text-[12px] text-white",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: `font-semibold ${g.winner === "A" ? "text-emerald-300" : ""}`,
                                                                children: g.teamA
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                                lineNumber: 528,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-white/60",
                                                                children: g.status
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                                lineNumber: 529,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                        lineNumber: 527,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between text-[12px] text-white",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: `font-semibold ${g.winner === "B" ? "text-emerald-300" : ""}`,
                                                                children: g.teamB
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                                lineNumber: 532,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-white/60",
                                                                children: g.score
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                                lineNumber: 533,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                        lineNumber: 531,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-2 text-[11px]",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            type: "text",
                                                            placeholder: "6-3, 6-4",
                                                            className: "flex-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1",
                                                            onBlur: (e)=>{
                                                                const v = e.target.value.trim();
                                                                if (v) submitResult(g.id, v);
                                                            }
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                            lineNumber: 536,
                                                            columnNumber: 27
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                        lineNumber: 535,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, g.id, true, {
                                                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                lineNumber: 523,
                                                columnNumber: 23
                                            }, this))
                                    ]
                                }, roundKey, true, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 516,
                                    columnNumber: 19
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                            lineNumber: 512,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 511,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 482,
                columnNumber: 9
            }, this),
            tab === "rankings" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3 text-sm",
                children: [
                    Object.keys(standings).length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-white/70",
                        children: "Sem standings."
                    }, void 0, false, {
                        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                        lineNumber: 559,
                        columnNumber: 51
                    }, this),
                    Object.entries(standings).map(([groupKey, rows])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl border border-white/15 bg-white/5 p-3 space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] uppercase tracking-[0.18em] text-white/60",
                                            children: [
                                                "Grupo ",
                                                groupKey
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 563,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[11px] text-white/50",
                                            children: [
                                                "Top ",
                                                rows.length
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 564,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 562,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-1",
                                    children: rows.map((r, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center justify-between",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "flex items-center gap-2 text-white/85",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-[11px] text-white/60",
                                                            children: [
                                                                "#",
                                                                idx + 1
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                            lineNumber: 570,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: pairingNameById.get(r.pairingId) ?? `Dupla ${r.pairingId}`
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                            lineNumber: 571,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                    lineNumber: 569,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-white/70",
                                                    children: [
                                                        "Pts ",
                                                        r.points,
                                                        " · ",
                                                        r.wins,
                                                        "V/",
                                                        r.losses,
                                                        "D · Sets ",
                                                        r.setsFor,
                                                        "-",
                                                        r.setsAgainst
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                                    lineNumber: 573,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, r.pairingId, true, {
                                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                            lineNumber: 568,
                                            columnNumber: 19
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                                    lineNumber: 566,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, groupKey, true, {
                            fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                            lineNumber: 561,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
                lineNumber: 558,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/organizador/eventos/[id]/PadelTournamentTabs.tsx",
        lineNumber: 294,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=app_organizador_eventos_%5Bid%5D_PadelTournamentTabs_tsx_6097f31e._.js.map