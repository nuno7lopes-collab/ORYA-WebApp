"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

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
} from "@/app/org/_internal/core/dashboardUi";

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

type ComposerMode = "rule" | "reward";

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
  error?: string;
  message?: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRewardPayload(params: {
  rewardType: (typeof REWARD_TYPES)[number];
  rewardCode: string;
  rewardValue: string;
}) {
  const code = params.rewardCode.trim();
  const value = parseNumber(params.rewardValue);

  switch (params.rewardType) {
    case "DISCOUNT":
      return {
        couponCode: code || "LOYALTY",
        ...(value !== null ? { discountPercent: value } : {}),
      };
    case "STORE_CREDIT":
      return {
        ...(value !== null ? { creditCents: value } : {}),
      };
    case "FREE_CLASS":
      return {
        ...(code ? { classRef: code } : {}),
      };
    case "FREE_EVENT":
      return {
        ...(code ? { eventRef: code } : {}),
      };
    case "PRODUCT":
      return {
        ...(code ? { sku: code } : {}),
      };
    case "EARLY_ACCESS":
      return {
        tag: code || "early_access",
      };
    default:
      return {};
  }
}

export default function CrmLoyaltyPage() {
  const { data, isLoading, mutate } = useSWR<LoyaltyProgramResponse>(resolveCanonicalOrgApiPath("/api/org/[orgId]/loyalty/programa"), fetcher);
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
  const [rewardCode, setRewardCode] = useState("");
  const [rewardValue, setRewardValue] = useState("");
  const [rewardSaving, setRewardSaving] = useState(false);

  const [composerMode, setComposerMode] = useState<ComposerMode>("rule");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    setProgramName(program.name);
    setPointsName(program.pointsName);
    setPointsExpiryDays(program.pointsExpiryDays?.toString() ?? "");
    setTermsUrl(program.termsUrl ?? "");
    setStatus(program.status);
  }, [program?.id, program?.name, program?.pointsName, program?.pointsExpiryDays, program?.termsUrl, program?.status]);

  const handleSaveProgram = async () => {
    setProgramSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        status,
        name: programName.trim() || "Pontos ORYA",
        pointsName: pointsName.trim() || "Pontos",
        pointsExpiryDays: parseNumber(pointsExpiryDays),
        termsUrl: termsUrl.trim() || null,
      };
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/loyalty/programa"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao guardar programa");
      }
      setSuccess("Programa guardado com sucesso.");
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
    setSuccess(null);
    try {
      const pointsValue = parseNumber(points);
      if (pointsValue === null) {
        throw new Error("Define a quantidade de pontos.");
      }

      const conditions: Record<string, unknown> = {};
      const minAmountValue = parseNumber(minAmountCents);
      const minTotalSpentValue = parseNumber(minTotalSpent);
      const minTotalOrdersValue = parseNumber(minTotalOrders);
      const minTotalBookingsValue = parseNumber(minTotalBookings);
      const minTotalAttendancesValue = parseNumber(minTotalAttendances);
      const minTotalTournamentsValue = parseNumber(minTotalTournaments);

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
        points: pointsValue,
        maxPointsPerDay: parseNumber(maxPerDay),
        maxPointsPerUser: parseNumber(maxPerUser),
        conditions,
        isActive: true,
      };
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/loyalty/regras"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao criar regra");
      }

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
      setSuccess("Regra criada com sucesso.");
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
    setSuccess(null);
    try {
      const pointsCostValue = parseNumber(pointsCost);
      if (pointsCostValue === null) {
        throw new Error("Define o custo em pontos.");
      }
      const stockValue = parseNumber(stock);
      const payloadConfig = buildRewardPayload({
        rewardType,
        rewardCode,
        rewardValue,
      });
      const payload = {
        name: rewardName.trim() || "Recompensa",
        type: rewardType,
        pointsCost: pointsCostValue,
        stock: stockValue,
        payload: payloadConfig,
        isActive: true,
      };
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/loyalty/recompensas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao criar recompensa");
      }
      setRewardName("");
      setPointsCost("");
      setStock("");
      setRewardCode("");
      setRewardValue("");
      setSuccess("Recompensa criada com sucesso.");
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
        <p className={DASHBOARD_MUTED}>Configuração do programa e automações de fidelização.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-[12px] text-emerald-100">{success}</div>
      ) : null}
      {data?.ok === false ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {data.error ?? data.message ?? "Não foi possível carregar o programa de loyalty."}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "space-y-4 p-4")}>
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
              type="number"
              min={0}
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

      <section className={cn(DASHBOARD_CARD, "space-y-4 p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(CTA_NEUTRAL, composerMode === "rule" ? "border-white/30 bg-white/12" : "")}
            onClick={() => setComposerMode("rule")}
          >
            Nova regra
          </button>
          <button
            type="button"
            className={cn(CTA_NEUTRAL, composerMode === "reward" ? "border-white/30 bg-white/12" : "")}
            onClick={() => setComposerMode("reward")}
          >
            Nova recompensa
          </button>
        </div>

        {composerMode === "rule" ? (
          <div className="space-y-4">
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
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={points}
                  onChange={(event) => setPoints(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Máx por dia
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={maxPerDay}
                  onChange={(event) => setMaxPerDay(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Máx por utilizador
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={maxPerUser}
                  onChange={(event) => setMaxPerUser(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Valor mínimo (cêntimos)
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={minAmountCents}
                  onChange={(event) => setMinAmountCents(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Total gasto mínimo
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={minTotalSpent}
                  onChange={(event) => setMinTotalSpent(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Total pedidos mínimo
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={minTotalOrders}
                  onChange={(event) => setMinTotalOrders(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Total reservas mínimo
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={minTotalBookings}
                  onChange={(event) => setMinTotalBookings(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Total check-ins mínimo
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={minTotalAttendances}
                  onChange={(event) => setMinTotalAttendances(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Total torneios mínimo
                <input
                  type="number"
                  min={0}
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
          </div>
        ) : (
          <div className="space-y-4">
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
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={pointsCost}
                  onChange={(event) => setPointsCost(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Stock
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                />
              </label>
              <label className="text-[12px] text-white/70 md:col-span-2">
                Código/Referência (opcional)
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={rewardCode}
                  onChange={(event) => setRewardCode(event.target.value)}
                  placeholder="cupão, SKU, classRef, eventRef"
                />
              </label>
              <label className="text-[12px] text-white/70 md:col-span-2">
                Valor (opcional)
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={rewardValue}
                  onChange={(event) => setRewardValue(event.target.value)}
                  placeholder="desconto %, crédito cêntimos, etc."
                />
              </label>
            </div>
            <button type="button" className={CTA_PRIMARY} onClick={handleCreateReward} disabled={rewardSaving}>
              {rewardSaving ? "A guardar..." : "Criar recompensa"}
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
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

        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
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
