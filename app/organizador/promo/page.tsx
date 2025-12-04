"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useUser } from "@/app/hooks/useUser";

type PromoCodeDto = {
  id: number;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
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
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PromoCodesPage() {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const { data, mutate } = useSWR<ListResponse>(
    user ? "/api/organizador/promo" : null,
    fetcher
  );

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

  useEffect(() => {
    if (!user && !data) {
      // forçar modal se não autenticado
      openModal({ mode: "login", redirectTo: "/organizador/promo", showGoogle: true });
    }
  }, [user, data, openModal]);

  const events = useMemo(() => data?.events ?? [], [data]);
  const promos = useMemo(() => data?.promoCodes ?? [], [data]);

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
      const payload = {
        code: form.code.trim(),
        type: form.type,
        value: Number(form.value),
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
      if (payload.type === "PERCENTAGE" && payload.value > 10000) {
        setError("Percentual inválido (valor em bps, máx 10000 = 100%).");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/organizador/promo", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível guardar o código.");
      } else {
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
      value: String(promo.value),
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
    if (!confirm("Apagar este código? Esta ação é definitiva.")) return;
    try {
      const res = await fetch("/api/organizador/promo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "Erro ao apagar o código.");
      } else {
        if (editingId === id) setEditingId(null);
        mutate();
      }
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao apagar código.");
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await fetch("/api/organizador/promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const stats = useMemo(() => {
    const total = promos.length;
    const active = promos.filter((p) => p.active).length;
    const redemptions = promos.reduce((acc, p) => acc + (p.redemptionsCount ?? 0), 0);
    return { total, active, redemptions };
  }, [promos]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 space-y-6 text-white md:px-6 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Códigos promocionais</h1>
          <p className="text-sm text-white/70">
            Cria códigos de desconto por evento ou globais. Podes ativar/desativar ou definir auto-aplicação a qualquer momento.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-white/60">Ativos</p>
            <p className="text-2xl font-bold">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-white/60">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-white/60">Redemptions</p>
            <p className="text-2xl font-bold">{stats.redemptions}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-5 space-y-3">
            <h3 className="text-lg font-semibold">Criar código</h3>
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {success}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-white/70">Código</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="ORYA10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "PERCENTAGE" | "FIXED" })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                >
                  <option value="PERCENTAGE">% (bps)</option>
                  <option value="FIXED">Valor fixo (€ cent)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Valor</label>
                <input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder={form.type === "PERCENTAGE" ? "Ex.: 1000 (10%)" : "Ex.: 500 (5€)"}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Evento</label>
                <select
                  value={form.eventId}
                  onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                >
                  <option value="global">Global</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Máx. utilizações</label>
                <input
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="ilimitado"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Limite por user</label>
                <input
                  type="number"
                  value={form.perUserLimit}
                  onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="ilimitado"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Min. quantidade (auto)</label>
                <input
                  type="number"
                  value={form.minQuantity}
                  onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="Ex.: 2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Min. total (€) (auto)</label>
                <input
                  type="number"
                  value={form.minTotal}
                  onChange={(e) => setForm({ ...form, minTotal: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="Ex.: 50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Válido desde</label>
                <input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-white/70">Válido até</label>
                <input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/70">Ativo</label>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 accent-[#6BFFFF]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/70">Aplicar automaticamente (sem código)</label>
              <input
                type="checkbox"
                checked={form.autoApply}
                onChange={(e) => setForm({ ...form, autoApply: e.target.checked })}
                className="h-4 w-4 accent-[#6BFFFF]"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-lg disabled:opacity-60"
            >
              {saving ? "A guardar..." : editingId ? "Guardar alterações" : "Criar código"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm((prev) => ({ ...prev, code: "" }));
                  setError(null);
                  setSuccess(null);
                }}
                className="text-[12px] text-white/70 underline"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Códigos existentes</h3>
              <div className="flex items-center gap-2">
                <select
                  value={filters.eventId}
                  onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value }))}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[12px] text-white/80 outline-none"
                >
                  <option value="all">Todos os eventos</option>
                  <option value="global">Globais</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={`${ev.id}`}>
                      {ev.title}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    const val = e.target.value as "all" | "active" | "inactive" | "auto";
                    setFilters((f) => ({ ...f, status: val }));
                  }}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[12px] text-white/80 outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="auto">Auto-aplicar</option>
                </select>
                <button
                  type="button"
                  onClick={() => mutate()}
                  className="text-[12px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
                >
                  Atualizar
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {filteredPromos.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-4 text-white/60">
                  Sem códigos ainda.
                </div>
              )}
              {filteredPromos.map((promo) => {
                const autoApply = !!promo.autoApply;
                const badgeClass = promo.active ? "bg-emerald-400/15 text-emerald-100" : "bg-white/10 text-white/70";
                const dateRange =
                  promo.validFrom || promo.validUntil
                    ? `${promo.validFrom ? new Date(promo.validFrom).toLocaleDateString("pt-PT") : "Sem início"} → ${
                        promo.validUntil ? new Date(promo.validUntil).toLocaleDateString("pt-PT") : "Sem fim"
                      }`
                    : "Sem janela";
                return (
                  <div
                    key={promo.id}
                    className="rounded-xl border border-white/12 bg-black/40 p-3 flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">
                          {promo.code}
                        </span>
                        <span className="text-[11px] text-white/60">
                          {promo.type === "PERCENTAGE" ? `${promo.value / 100}%` : `${(promo.value / 100).toFixed(2)} €`}
                        </span>
                        {promo.eventId && (
                          <span className="text-[11px] text-white/60">Evento #{promo.eventId}</span>
                        )}
                        {autoApply && (
                          <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[11px] text-cyan-100">
                            Auto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${badgeClass}`}>
                          {promo.active ? "Ativo" : "Inativo"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEdit(promo)}
                          className="text-[11px] rounded-full border border-white/20 px-2 py-0.5 text-white/80 hover:bg-white/10"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggle(promo.id, !promo.active)}
                          className="text-[11px] rounded-full border border-white/20 px-2 py-0.5 text-white/80 hover:bg-white/10"
                        >
                          {promo.active ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(promo.id)}
                          className="text-[11px] rounded-full border border-red-400/30 px-2 py-0.5 text-red-200 hover:bg-red-500/10"
                        >
                          Apagar
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-white/60 flex gap-3 flex-wrap">
                      <span>Usos: {promo.redemptionsCount ?? 0}</span>
                      {promo.maxUses && <span>Máximo: {promo.maxUses}</span>}
                      {promo.perUserLimit && <span>Por utilizador: {promo.perUserLimit}</span>}
                      {promo.validFrom || promo.validUntil ? <span>{dateRange}</span> : null}
                      {promo.eventId === null && <span>Global</span>}
                      {promo.minQuantity ? <span>Mín. qtd: {promo.minQuantity}</span> : null}
                      {promo.minTotalCents ? <span>Mín. total: {(promo.minTotalCents / 100).toFixed(2)} €</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
  );
}
