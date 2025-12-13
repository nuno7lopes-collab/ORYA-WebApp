"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useUser } from "@/app/hooks/useUser";
import { trackEvent } from "@/lib/analytics";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";

type PromoCodeDto = {
  id: number;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  status?: "ACTIVE" | "INACTIVE" | "EXPIRED";
  maxUses: number | null;
  perUserLimit: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  eventId: number | null;
  createdAt: string;
  updatedAt: string;
  redemptionsCount?: number;
  autoApply?: boolean;
  minQuantity?: number | null;
  minTotalCents?: number | null;
};

type ListResponse = {
  ok: boolean;
  promoCodes: PromoCodeDto[];
  events: { id: number; title: string; slug: string }[];
  promoStats?: {
    promoCodeId: number;
    tickets: number;
    grossCents: number;
    discountCents: number;
    platformFeeCents: number;
    netCents: number;
  }[];
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SUGGESTED_CODES = [
  { code: "ORYA10", type: "PERCENTAGE" as const, value: "10", hint: "Friends & Family · 10%" },
  { code: "EARLY15", type: "PERCENTAGE" as const, value: "15", hint: "Early bird limitado" },
  { code: "TEAM5", type: "FIXED" as const, value: "5", hint: "5 € por pessoa para grupos" },
];

function PromoStatusBadge({ status, active }: { status?: "ACTIVE" | "INACTIVE" | "EXPIRED"; active: boolean }) {
  const finalStatus = status || (active ? "ACTIVE" : "INACTIVE");
  const className =
    finalStatus === "EXPIRED"
      ? "border border-amber-400/40 bg-amber-500/15 text-amber-100"
      : finalStatus === "ACTIVE"
        ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
        : "border border-white/15 bg-white/10 text-white/70";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] ${className}`}>
      {finalStatus === "EXPIRED" ? "Expirada" : finalStatus === "ACTIVE" ? "Ativo" : "Inativo"}
    </span>
  );
}

export default function PromoCodesClient() {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const { data, mutate } = useSWR<ListResponse>(user ? "/api/organizador/promo" : null, fetcher);

  const [filters, setFilters] = useState({
    eventId: "all",
    status: "all" as "all" | "active" | "inactive" | "auto",
  });
  const [form, setForm] = useState({
    code: "",
    type: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
    value: "10",
    maxUses: "",
    perUserLimit: "",
    validFrom: "",
    validUntil: "",
    eventId: "global",
    active: true,
    autoApply: false,
    minQuantity: "",
    minTotal: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loading = !data;
  useEffect(() => {
    if (!user && !data) {
      openModal({ mode: "login", redirectTo: "/organizador/promo", showGoogle: true });
    }
  }, [user, data, openModal]);

  const events = useMemo(() => data?.events ?? [], [data]);
  const promos = useMemo(() => data?.promoCodes ?? [], [data]);
  const promoStats = useMemo(() => data?.promoStats ?? [], [data]);
  const promoStatsMap = useMemo(() => new Map(promoStats.map((s) => [s.promoCodeId, s])), [promoStats]);

  const filteredPromos = useMemo(() => {
    return promos.filter((p) => {
      const autoApply = !!p.autoApply;
      if (filters.eventId !== "all" && `${p.eventId ?? "global"}` !== filters.eventId) return false;
      if (filters.status === "active" && !p.active) return false;
      if (filters.status === "inactive" && p.active) return false;
      if (filters.status === "auto" && !autoApply) return false;
      return true;
    });
  }, [promos, filters]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const numericValue = Number(form.value);
      if (form.type === "PERCENTAGE") {
        if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 100) {
          setError("Percentagem inválida. Usa 1% a 100%.");
          setSaving(false);
          return;
        }
      } else if (!Number.isFinite(numericValue) || numericValue < 0) {
        setError("Valor inválido. Usa um número igual ou superior a 0.");
        setSaving(false);
        return;
      }

      const payload = {
        code: form.code.trim(),
        type: form.type,
        value:
          form.type === "PERCENTAGE"
            ? Math.round(numericValue * 100) // guardamos em bps para manter compat
            : Math.round(numericValue * 100), // euros -> cents
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        eventId: form.eventId === "global" ? null : Number(form.eventId),
        active: form.active,
        autoApply: form.autoApply,
        minQuantity: form.minQuantity ? Number(form.minQuantity) : null,
        minTotalCents: form.minTotal ? Math.round(Number(form.minTotal) * 100) : null,
      };
      const res = await fetch("/api/organizador/promo", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível guardar o código.");
      } else {
        trackEvent("promo_code_created", {
          scope: payload.eventId ? "event" : "global",
          type: payload.type,
        });
        setSuccess(editingId ? "Código atualizado." : "Código criado com sucesso.");
        setForm((prev) => ({ ...prev, code: "" }));
        setEditingId(null);
        mutate();
      }
    } catch (err) {
      console.error(err);
      setError("Erro inesperado ao guardar código.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (promo: PromoCodeDto) => {
    setEditingId(promo.id);
    setForm({
      code: promo.code,
      type: promo.type,
      value: promo.type === "PERCENTAGE" ? String(promo.value / 100) : String(promo.value / 100),
      maxUses: promo.maxUses != null ? String(promo.maxUses) : "",
      perUserLimit: promo.perUserLimit != null ? String(promo.perUserLimit) : "",
      validFrom: promo.validFrom ?? "",
      validUntil: promo.validUntil ?? "",
      eventId: promo.eventId == null ? "global" : String(promo.eventId),
      active: promo.active,
      autoApply: !!promo.autoApply,
      minQuantity: promo.minQuantity != null ? String(promo.minQuantity) : "",
      minTotal: promo.minTotalCents != null ? String(promo.minTotalCents / 100) : "",
    });
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch("/api/organizador/promo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error || "Erro ao apagar o código.");
      } else {
        trackEvent("promo_code_deleted", { promoId: id });
        if (editingId === id) setEditingId(null);
        mutate();
      }
    } catch (err) {
      console.error(err);
      setError("Erro inesperado ao apagar código.");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await fetch("/api/organizador/promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      trackEvent(active ? "promo_code_activated" : "promo_code_deactivated", { promoId: id });
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const emptyState = filteredPromos.length === 0 && !loading;

  const stats = useMemo(() => {
    const total = promos.length;
    const active = promos.filter((p) => p.active).length;
    const redemptions = promos.reduce((acc, p) => acc + (p.redemptionsCount ?? 0), 0);
    const totalDiscount = promoStats.reduce((acc, s) => acc + (s.discountCents ?? 0), 0);
    const totalGross = promoStats.reduce((acc, s) => acc + (s.grossCents ?? 0), 0);
    return { total, active, redemptions, totalDiscount, totalGross };
  }, [promos, promoStats]);

  const formatEuro = (cents: number) => `${(cents / 100).toFixed(2)} €`;
  const statsFor = (promoId: number) =>
    promoStatsMap.get(promoId) ?? { tickets: 0, grossCents: 0, discountCents: 0, netCents: 0 };

  const previewPrice = 20; // € exemplo
  const preview = useMemo(() => {
    const valueNum = Number(form.value) || 0;
    const baseCents = Math.max(0, Math.round(previewPrice * 100));
    const discountCents =
      form.type === "PERCENTAGE"
        ? Math.min(baseCents, Math.round((baseCents * Math.min(100, Math.max(0, valueNum))) / 100))
        : Math.min(baseCents, Math.round(valueNum * 100));
    const totalCents = Math.max(0, baseCents - discountCents);
    return {
      base: baseCents / 100,
      discount: discountCents / 100,
      total: totalCents / 100,
    };
  }, [form.type, form.value]);

  const applySuggestion = (code: string, type: "PERCENTAGE" | "FIXED", value: string) => {
    setForm((prev) => ({ ...prev, code, type, value }));
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 space-y-6 text-white md:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Códigos promocionais</h1>
        <p className="text-sm text-white/70">
          Cria códigos de desconto por evento ou globais. Podes ativar/desativar ou definir auto-aplicação a qualquer momento.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-4">
        {loading
          ? [...Array(3)].map((_, idx) => (
              <div key={idx} className="animate-pulse space-y-2">
                <div className="h-3 w-24 rounded bg-white/15" />
                <div className="h-6 w-20 rounded bg-white/20" />
              </div>
            ))
          : (
            <>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Total</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Ativos</p>
                <p className="text-2xl font-semibold">{stats.active}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Utilizações</p>
                <p className="text-2xl font-semibold">{stats.redemptions}</p>
                <p className="text-[11px] text-white/50">Conta bilhetes (sale_lines)</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Desconto total</p>
                <p className="text-2xl font-semibold">{formatEuro(stats.totalDiscount)}</p>
                <p className="text-[11px] text-white/50">Bruto via promo: {formatEuro(stats.totalGross)}</p>
              </div>
            </>
          )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
          Evento:
          <select
            value={filters.eventId}
            onChange={(e) => setFilters((p) => ({ ...p, eventId: e.target.value }))}
            className="bg-transparent outline-none"
          >
            <option value="all">Todos</option>
            <option value="global">Globais</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
          Estado:
          <select
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as typeof filters.status }))}
            className="bg-transparent outline-none"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="auto">Auto-aplicados</option>
          </select>
          </label>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <p className="text-white/80 font-semibold">Sugestões de códigos</p>
            <span className="text-[11px] text-white/60">Preenche o formulário com 1 clique</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_CODES.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => applySuggestion(item.code, item.type, item.value)}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30"
              >
                <span className="font-semibold">{item.code}</span>
                <span className="text-white/60">{item.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-white/10">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-white/15" />
                    <div className="h-3 w-32 rounded bg-white/10" />
                  </div>
                  <div className="h-7 w-20 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          ) : emptyState ? (
            <div className="flex flex-col gap-3 p-5 text-white">
              <div>
                <p className="text-lg font-semibold">Ainda não tens códigos promocionais.</p>
                <p className="text-sm text-white/70">Cria o teu primeiro código para recompensar equipas, amigos ou early birds.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document?.getElementById("promo-form");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01]"
                >
                  Criar primeiro código
                </button>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_CODES.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => applySuggestion(item.code, item.type, item.value)}
                      className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30"
                    >
                      {item.code} · {item.hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-[12px] uppercase tracking-[0.12em] text-white/60">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Usos</th>
                  <th className="px-3 py-2">Bilhetes</th>
                  <th className="px-3 py-2">Bruto</th>
                  <th className="px-3 py-2">Desconto</th>
                  <th className="px-3 py-2">Líquido</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromos.map((promo) => {
                  const s = statsFor(promo.id);
                  return (
                    <tr key={promo.id} className="border-t border-white/10">
                      <td className="px-3 py-2 font-semibold text-white">{promo.code}</td>
                      <td className="px-3 py-2">
                        {promo.eventId == null
                          ? "Global"
                          : events.find((ev) => ev.id === promo.eventId)?.title || "Evento removido"}
                      </td>
                      <td className="px-3 py-2">
                        {promo.type === "PERCENTAGE"
                          ? `${(promo.value / 100).toFixed(2).replace(/\\.00$/, "")}%`
                          : `${(promo.value / 100).toFixed(2).replace(/\\.00$/, "")} €`}
                      </td>
                      <td className="px-3 py-2">{promo.redemptionsCount ?? 0}</td>
                      <td className="px-3 py-2">
                        {s.tickets}
                      </td>
                      <td className="px-3 py-2">
                        {formatEuro(s.grossCents ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-emerald-200">
                        -{formatEuro(s.discountCents ?? 0)}
                      </td>
                      <td className="px-3 py-2">
                        {formatEuro(s.netCents ?? 0)}
                      </td>
                      <td className="px-3 py-2">
                        <PromoStatusBadge status={promo.status} active={promo.active} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(promo)}
                            className="rounded-full border border-white/20 px-2 py-1 text-[11px] hover:bg-white/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(promo.id, !promo.active)}
                            className="rounded-full border border-white/20 px-2 py-1 text-[11px] hover:bg-white/10"
                          >
                            {promo.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(promo.id)}
                            className="text-[11px] text-red-300 hover:text-red-200"
                          >
                            Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <ConfirmDestructiveActionDialog
          open={deleteId !== null}
          title="Apagar código promocional?"
          description="Esta ação é definitiva e remove o código da tua lista."
          consequences={[
            "O código deixa de ser aplicável no checkout.",
            "Mantemos histórico de utilizações anteriores.",
          ]}
          confirmLabel="Apagar código"
          cancelLabel="Cancelar"
          dangerLevel="high"
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            if (deleteId !== null) handleDelete(deleteId);
          }}
        />

        <div id="promo-form" className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">Criar / editar código</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            Código
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white"
              placeholder="ORYA10"
            />
          </label>
          <label className="space-y-1 text-sm">
            Tipo
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as "PERCENTAGE" | "FIXED" }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
            >
              <option value="PERCENTAGE">% desconto</option>
              <option value="FIXED">€ desconto</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Valor
            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 pr-12 text-sm outline-none"
                placeholder={form.type === "PERCENTAGE" ? "Ex.: 10 = 10%" : "Ex.: 5 = 5 €"}
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-[12px] text-white/60">
                {form.type === "PERCENTAGE" ? "%" : "€"}
              </span>
            </div>
            <p className="text-[11px] text-white/60">
              {form.type === "PERCENTAGE" ? "Entre 1% e 100%." : "Valor fixo em euros."}
            </p>
          </label>
          <label className="space-y-1 text-sm">
            Nº máximo de utilizações
            <input
              type="number"
              min={0}
              value={form.maxUses}
              onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
              placeholder="Ex.: 200 (opcional)"
            />
          </label>
          <label className="space-y-1 text-sm">
            Limite por pessoa
            <input
              type="number"
              min={0}
              value={form.perUserLimit}
              onChange={(e) => setForm((p) => ({ ...p, perUserLimit: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
              placeholder="Ex.: 2 (opcional)"
            />
          </label>
          <label className="space-y-1 text-sm">
            Evento
            <select
              value={form.eventId}
              onChange={(e) => setForm((p) => ({ ...p, eventId: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
            >
              <option value="global">Global</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Válido de
            <input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            Válido até
            <input
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            Mín. quantidade por compra
            <input
              type="number"
              min={0}
              value={form.minQuantity}
              onChange={(e) => setForm((p) => ({ ...p, minQuantity: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
              placeholder="Ex.: 2"
            />
          </label>
          <label className="space-y-1 text-sm">
            Mín. valor total (€)
            <input
              type="number"
              min={0}
              value={form.minTotal}
              onChange={(e) => setForm((p) => ({ ...p, minTotal: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
              placeholder="Ex.: 20"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 text-[12px] text-white/75">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              className="h-4 w-4"
            />
            Ativo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.autoApply}
              onChange={(e) => setForm((p) => ({ ...p, autoApply: e.target.checked }))}
              className="h-4 w-4"
            />
            Auto-aplicar em checkout (se válido)
          </label>
        </div>

        {(error || success) && (
          <div className="text-[12px]">
            {error && <p className="text-red-300">{error}</p>}
            {success && <p className="text-emerald-200">{success}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60"
          >
            {saving ? "A guardar..." : editingId ? "Guardar alterações" : "Criar código"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({
                code: "",
                type: "PERCENTAGE",
                value: "10",
                maxUses: "",
                perUserLimit: "",
                validFrom: "",
                validUntil: "",
                eventId: "global",
                active: true,
                autoApply: false,
                minQuantity: "",
                minTotal: "",
              });
              setEditingId(null);
              setError(null);
              setSuccess(null);
            }}
            className="rounded-full border border-white/20 px-3 py-2 text-[12px] text-white hover:bg-white/10"
          >
            Limpar
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[12px] text-white/80">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Preview rápido</p>
          <p className="text-sm">
            Exemplo com bilhete de {preview.base.toFixed(2)} € → Cliente paga{" "}
            <span className="font-semibold text-white">{preview.total.toFixed(2)} €</span>{" "}
            (desconto {preview.discount.toFixed(2)} €)
          </p>
        </div>
      </div>
    </section>
  );
}
