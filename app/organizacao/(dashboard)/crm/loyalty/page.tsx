"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
  CTA_PRIMARY,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const TRIGGERS = [
  "STORE_ORDER_PAID",
  "BOOKING_COMPLETED",
  "EVENT_CHECKIN",
  "TOURNAMENT_PARTICIPATION",
  "MEMBERSHIP_RENEWAL",
] as const;

const REWARD_TYPES = [
  "DISCOUNT",
  "FREE_CLASS",
  "FREE_EVENT",
  "STORE_CREDIT",
  "PRODUCT",
  "EARLY_ACCESS",
] as const;

type LoyaltyProgramResponse = {
  ok: boolean;
  program: {
    id: string;
    status: string;
    name: string;
    pointsName: string;
    pointsExpiryDays: number | null;
    termsUrl: string | null;
    rules: Array<{
      id: string;
      name: string;
      trigger: string;
      points: number;
      maxPointsPerDay: number | null;
      maxPointsPerUser: number | null;
      isActive: boolean;
      createdAt: string;
    }>;
    rewards: Array<{
      id: string;
      name: string;
      type: string;
      pointsCost: number;
      stock: number | null;
      isActive: boolean;
      createdAt: string;
    }>;
  } | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

export default function CrmLoyaltyPage() {
  const { data, isLoading, mutate } = useSWR<LoyaltyProgramResponse>(
    "/api/organizacao/loyalty/programa",
    fetcher,
  );

  const program = data?.program ?? null;
  const [programName, setProgramName] = useState("");
  const [pointsName, setPointsName] = useState("");
  const [pointsExpiryDays, setPointsExpiryDays] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [programSaving, setProgramSaving] = useState(false);

  const [ruleName, setRuleName] = useState("");
  const [trigger, setTrigger] = useState<(typeof TRIGGERS)[number]>(TRIGGERS[0]);
  const [points, setPoints] = useState("");
  const [maxPerDay, setMaxPerDay] = useState("");
  const [maxPerUser, setMaxPerUser] = useState("");
  const [minAmountCents, setMinAmountCents] = useState("");
  const [minTotalSpent, setMinTotalSpent] = useState("");
  const [minTotalOrders, setMinTotalOrders] = useState("");
  const [minTotalBookings, setMinTotalBookings] = useState("");
  const [minTotalAttendances, setMinTotalAttendances] = useState("");
  const [minTotalTournaments, setMinTotalTournaments] = useState("");
  const [requiredTags, setRequiredTags] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);

  const [rewardName, setRewardName] = useState("");
  const [rewardType, setRewardType] = useState<(typeof REWARD_TYPES)[number]>(REWARD_TYPES[0]);
  const [pointsCost, setPointsCost] = useState("");
  const [stock, setStock] = useState("");
  const [rewardPayload, setRewardPayload] = useState("");
  const [rewardSaving, setRewardSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const parseNumber = (value: string) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  useEffect(() => {
    if (!program) return;
    setProgramName(program.name);
    setPointsName(program.pointsName);
    setPointsExpiryDays(program.pointsExpiryDays?.toString() ?? "");
    setTermsUrl(program.termsUrl ?? "");
    setStatus(program.status);
  }, [
    program?.id,
    program?.name,
    program?.pointsName,
    program?.pointsExpiryDays,
    program?.termsUrl,
    program?.status,
  ]);

  const handleSaveProgram = async () => {
    setProgramSaving(true);
    setError(null);
    try {
      const payload = {
        status,
        name: programName.trim() || "Pontos ORYA",
        pointsName: pointsName.trim() || "Pontos",
        pointsExpiryDays: parseNumber(pointsExpiryDays.trim()),
        termsUrl: termsUrl.trim() || null,
      };
      const res = await fetch("/api/organizacao/loyalty/programa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao guardar programa");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar programa");
    } finally {
      setProgramSaving(false);
    }
  };

  const handleCreateRule = async () => {
    setRuleSaving(true);
    setError(null);
    try {
      if (!points.trim() || Number.isNaN(Number(points))) {
        throw new Error("Define a quantidade de pontos.");
      }
      const conditions: Record<string, unknown> = {};
      const minAmountValue = parseNumber(minAmountCents.trim());
      const minTotalSpentValue = parseNumber(minTotalSpent.trim());
      const minTotalOrdersValue = parseNumber(minTotalOrders.trim());
      const minTotalBookingsValue = parseNumber(minTotalBookings.trim());
      const minTotalAttendancesValue = parseNumber(minTotalAttendances.trim());
      const minTotalTournamentsValue = parseNumber(minTotalTournaments.trim());
      if (minAmountValue !== null) conditions.minAmountCents = minAmountValue;
      if (minTotalSpentValue !== null) conditions.minTotalSpentCents = minTotalSpentValue;
      if (minTotalOrdersValue !== null) conditions.minTotalOrders = minTotalOrdersValue;
      if (minTotalBookingsValue !== null) conditions.minTotalBookings = minTotalBookingsValue;
      if (minTotalAttendancesValue !== null) conditions.minTotalAttendances = minTotalAttendancesValue;
      if (minTotalTournamentsValue !== null) conditions.minTotalTournaments = minTotalTournamentsValue;
      if (requiredTags.trim()) {
        conditions.requiredTags = requiredTags.split(",").map((tag) => tag.trim()).filter(Boolean);
      }

      const payload = {
        name: ruleName.trim() || "Regra",
        trigger,
        points: Number(points),
        maxPointsPerDay: parseNumber(maxPerDay.trim()),
        maxPointsPerUser: parseNumber(maxPerUser.trim()),
        conditions,
        isActive: true,
      };
      const res = await fetch("/api/organizacao/loyalty/regras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao criar regra");
      setRuleName("");
      setPoints("");
      setMaxPerDay("");
      setMaxPerUser("");
      setMinAmountCents("");
      setMinTotalSpent("");
      setMinTotalOrders("");
      setMinTotalBookings("");
      setMinTotalAttendances("");
      setMinTotalTournaments("");
      setRequiredTags("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar regra");
    } finally {
      setRuleSaving(false);
    }
  };

  const handleCreateReward = async () => {
    setRewardSaving(true);
    setError(null);
    try {
      let parsedPayload: Record<string, unknown> = {};
      if (rewardPayload.trim()) {
        parsedPayload = JSON.parse(rewardPayload);
      }
      const pointsCostValue = parseNumber(pointsCost.trim());
      if (pointsCostValue === null) {
        throw new Error("Define o custo em pontos.");
      }
      const stockValue = parseNumber(stock.trim());
      const payload = {
        name: rewardName.trim() || "Recompensa",
        type: rewardType,
        pointsCost: pointsCostValue,
        stock: stockValue,
        payload: parsedPayload,
        isActive: true,
      };
      const res = await fetch("/api/organizacao/loyalty/recompensas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao criar recompensa");
      setRewardName("");
      setPointsCost("");
      setStock("");
      setRewardPayload("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar recompensa");
    } finally {
      setRewardSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Pontos & recompensas</h1>
        <p className={DASHBOARD_MUTED}>Configuração do programa de loyalty por organização.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-4")}
      >
        <h2 className="text-sm font-semibold text-white">Programa</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Nome
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={programName}
              onChange={(event) => setProgramName(event.target.value)}
              placeholder={program?.name ?? "Pontos ORYA"}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Nome dos pontos
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={pointsName}
              onChange={(event) => setPointsName(event.target.value)}
              placeholder={program?.pointsName ?? "Pontos"}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Expiração (dias)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={pointsExpiryDays}
              onChange={(event) => setPointsExpiryDays(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Status
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="DISABLED">Desativado</option>
            </select>
          </label>
          <label className="text-[12px] text-white/70 md:col-span-2">
            Termos (URL)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={termsUrl}
              onChange={(event) => setTermsUrl(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className={CTA_PRIMARY} onClick={handleSaveProgram} disabled={programSaving}>
          {programSaving ? "A guardar..." : "Guardar programa"}
        </button>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-4")}
      >
        <h2 className="text-sm font-semibold text-white">Nova regra</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Nome da regra
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={ruleName}
              onChange={(event) => setRuleName(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Trigger
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={trigger}
              onChange={(event) => setTrigger(event.target.value as (typeof TRIGGERS)[number])}
            >
              {TRIGGERS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-white/70">
            Pontos
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Máx por dia
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={maxPerDay}
              onChange={(event) => setMaxPerDay(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Máx por utilizador
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={maxPerUser}
              onChange={(event) => setMaxPerUser(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Valor mínimo (cêntimos)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={minAmountCents}
              onChange={(event) => setMinAmountCents(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Total gasto mínimo
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={minTotalSpent}
              onChange={(event) => setMinTotalSpent(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Total pedidos mínimo
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={minTotalOrders}
              onChange={(event) => setMinTotalOrders(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Total reservas mínimo
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={minTotalBookings}
              onChange={(event) => setMinTotalBookings(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Total check-ins mínimo
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={minTotalAttendances}
              onChange={(event) => setMinTotalAttendances(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Total torneios mínimo
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={minTotalTournaments}
              onChange={(event) => setMinTotalTournaments(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70 md:col-span-2">
            Tags obrigatórias (separadas por vírgula)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={requiredTags}
              onChange={(event) => setRequiredTags(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className={CTA_PRIMARY} onClick={handleCreateRule} disabled={ruleSaving}>
          {ruleSaving ? "A guardar..." : "Criar regra"}
        </button>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-4")}
      >
        <h2 className="text-sm font-semibold text-white">Nova recompensa</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Nome
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={rewardName}
              onChange={(event) => setRewardName(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Tipo
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={rewardType}
              onChange={(event) => setRewardType(event.target.value as (typeof REWARD_TYPES)[number])}
            >
              {REWARD_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-white/70">
            Custo (pontos)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={pointsCost}
              onChange={(event) => setPointsCost(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Stock
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70 md:col-span-2">
            Payload (JSON)
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={rewardPayload}
              onChange={(event) => setRewardPayload(event.target.value)}
              placeholder='{"couponCode": "PROMO10"}'
            />
          </label>
        </div>
        <button type="button" className={CTA_PRIMARY} onClick={handleCreateReward} disabled={rewardSaving}>
          {rewardSaving ? "A guardar..." : "Criar recompensa"}
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Regras ativas</h2>
            <span className="text-[11px] text-white/50">{program?.rules?.length ?? 0} regras</span>
          </div>
          {program?.rules?.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-white">{rule.name}</p>
                  <p className="text-[11px] text-white/50">{rule.trigger}</p>
                </div>
                <div className="text-right text-[11px] text-white/60">
                  <p>{rule.points} pontos</p>
                  <p>{rule.isActive ? "Ativa" : "Inativa"}</p>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-white/40">Criada: {formatDate(rule.createdAt)}</p>
            </div>
          ))}
          {!isLoading && (!program || program.rules.length === 0) ? (
            <p className="text-[12px] text-white/50">Sem regras configuradas.</p>
          ) : null}
        </div>
        <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recompensas</h2>
            <span className="text-[11px] text-white/50">{program?.rewards?.length ?? 0} recompensas</span>
          </div>
          {program?.rewards?.map((reward) => (
            <div key={reward.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-white">{reward.name}</p>
                  <p className="text-[11px] text-white/50">{reward.type}</p>
                </div>
                <div className="text-right text-[11px] text-white/60">
                  <p>{reward.pointsCost} pontos</p>
                  <p>Stock: {reward.stock ?? "∞"}</p>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-white/40">Criada: {formatDate(reward.createdAt)}</p>
            </div>
          ))}
          {!isLoading && (!program || program.rewards.length === 0) ? (
            <p className="text-[12px] text-white/50">Sem recompensas configuradas.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
