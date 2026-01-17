"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type ZoneOption = {
  id: number;
  name: string;
};

type MethodItem = {
  id: number;
  zoneId: number;
  name: string;
  description: string | null;
  baseRateCents: number | null;
  mode: "FLAT" | "VALUE_TIERS";
  freeOverCents: number | null;
  isDefault: boolean;
  etaMinDays: number | null;
  etaMaxDays: number | null;
};

type StoreShippingMethodsPanelProps = {
  zonesEndpoint: string;
  storeEnabled: boolean;
};

type MethodFormState = {
  name: string;
  description: string;
  baseRate: string;
  mode: "FLAT" | "VALUE_TIERS";
  freeOver: string;
  isDefault: boolean;
  etaMinDays: string;
  etaMaxDays: string;
};

const SHIPPING_MODES = [
  { value: "FLAT", label: "Flat" },
  { value: "VALUE_TIERS", label: "Tiers" },
] as const;

function createEmptyForm(): MethodFormState {
  return {
    name: "",
    description: "",
    baseRate: "",
    mode: "FLAT",
    freeOver: "",
    isDefault: false,
    etaMinDays: "",
    etaMaxDays: "",
  };
}

function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(",", ".");
  if (!cleaned.trim()) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function formatCurrencyInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function formatEta(minDays: number | null, maxDays: number | null) {
  if (minDays !== null && maxDays !== null) return `${minDays}-${maxDays} dias`;
  if (minDays !== null) return `${minDays}+ dias`;
  if (maxDays !== null) return `ate ${maxDays} dias`;
  return "-";
}

export default function StoreShippingMethodsPanel({
  zonesEndpoint,
  storeEnabled,
}: StoreShippingMethodsPanelProps) {
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [methods, setMethods] = useState<MethodItem[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MethodFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const canEdit = storeEnabled;

  const zoneId = useMemo(() => {
    const parsed = Number(selectedZoneId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedZoneId]);

  const methodModeLabel = (mode: MethodItem["mode"]) =>
    SHIPPING_MODES.find((item) => item.value === mode)?.label ?? mode;

  const loadZones = async () => {
    setLoadingZones(true);
    setError(null);
    try {
      const res = await fetch(zonesEndpoint, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar zonas.");
      }
      const next = Array.isArray(json.items) ? json.items : [];
      setZones(next);
      if (!selectedZoneId && next.length > 0) {
        setSelectedZoneId(String(next[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingZones(false);
    }
  };

  const loadMethods = async (targetZoneId: number) => {
    setLoadingMethods(true);
    setError(null);
    try {
      const res = await fetch(`${zonesEndpoint}/${targetZoneId}/methods`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar metodos.");
      }
      setMethods(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingMethods(false);
    }
  };

  useEffect(() => {
    void loadZones();
  }, [zonesEndpoint]);

  useEffect(() => {
    if (!zoneId) {
      setMethods([]);
      return;
    }
    void loadMethods(zoneId);
  }, [zoneId]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return methods;
    return methods.filter((item) =>
      [item.name, item.description ?? "", item.mode].join(" ").toLowerCase().includes(term),
    );
  }, [methods, searchTerm]);

  const confirmDeleteItem = useMemo(
    () => methods.find((item) => item.id === confirmDeleteId) ?? null,
    [methods, confirmDeleteId],
  );

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(createEmptyForm());
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: MethodItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      baseRate: formatCurrencyInput(item.baseRateCents),
      mode: item.mode,
      freeOver: formatCurrencyInput(item.freeOverCents),
      isDefault: item.isDefault,
      etaMinDays: item.etaMinDays !== null ? String(item.etaMinDays) : "",
      etaMaxDays: item.etaMaxDays !== null ? String(item.etaMaxDays) : "",
    });
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalError(null);
    setEditingId(null);
  };

  const buildPayload = () => {
    const name = form.name.trim();
    if (!name) {
      return { ok: false as const, error: "Nome obrigatorio." };
    }
    const baseRateCents = parseCurrencyInput(form.baseRate);
    if (baseRateCents === null) {
      return { ok: false as const, error: "Base invalida." };
    }
    const freeOverCents = parseCurrencyInput(form.freeOver);
    const etaMinDays = parseOptionalInt(form.etaMinDays);
    const etaMaxDays = parseOptionalInt(form.etaMaxDays);
    if (etaMinDays !== null && etaMaxDays !== null && etaMinDays > etaMaxDays) {
      return { ok: false as const, error: "ETA invalida." };
    }

    return {
      ok: true as const,
      payload: {
        name,
        description: form.description.trim() || null,
        baseRateCents,
        mode: form.mode,
        freeOverCents: freeOverCents ?? null,
        isDefault: form.isDefault,
        etaMinDays,
        etaMaxDays,
      },
    };
  };

  const handleCreate = async () => {
    if (!canEdit || !zoneId) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(-1);
    setModalError(null);
    try {
      const res = await fetch(`${zonesEndpoint}/${zoneId}/methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar metodo.");
      }
      setMethods((prev) => [json.item, ...prev]);
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!canEdit) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(id);
    setModalError(null);
    try {
      const res = await fetch(`${zonesEndpoint.replace(/\/zones$/, "")}/methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar metodo.");
      }
      setMethods((prev) => prev.map((entry) => (entry.id === id ? json.item : entry)));
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canEdit) return;
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`${zonesEndpoint.replace(/\/zones$/, "")}/methods/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover metodo.");
      }
      setMethods((prev) => prev.filter((entry) => entry.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <StorePanelModal
        open={modalOpen}
        onClose={closeModal}
        eyebrow={modalMode === "create" ? "Novo metodo" : "Editar metodo"}
        title={modalMode === "create" ? "Metodo de envio" : form.name || "Metodo"}
        description="Define o preco base, modo e prazos de entrega."
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:border-white/40"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canEdit || savingId !== null}
              onClick={() => {
                if (modalMode === "create") {
                  void handleCreate();
                } else if (editingId) {
                  void handleUpdate(editingId);
                }
              }}
              className="rounded-full border border-white/20 bg-white/85 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {savingId !== null
                ? "A guardar..."
                : modalMode === "create"
                  ? "Criar metodo"
                  : "Guardar alteracoes"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-white/70">
              Nome
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Standard"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-white/70">
              Descricao
              <input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Entrega 2-4 dias"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-white/70">
              Base (EUR)
              <input
                value={form.baseRate}
                onChange={(e) => setForm((prev) => ({ ...prev, baseRate: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-white/70">
              Gratis a partir de
              <input
                value={form.freeOver}
                onChange={(e) => setForm((prev) => ({ ...prev, freeOver: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Opcional"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-white/70">
              Modo de envio
              <select
                value={form.mode}
                onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value as MethodFormState["mode"] }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              >
                {SHIPPING_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              {form.mode === "VALUE_TIERS" ? (
                <span className="text-[11px] text-white/50">
                  Define os escaloes no separador Tabelas.
                </span>
              ) : null}
            </label>
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-xs text-white/70">
                ETA min (dias)
                <input
                  type="number"
                  value={form.etaMinDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, etaMinDays: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  placeholder="2"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/70">
                ETA max (dias)
                <input
                  type="number"
                  value={form.etaMaxDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, etaMaxDays: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  placeholder="5"
                />
              </label>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              className="accent-[#6BFFFF]"
            />
            Metodo default
          </label>
        </div>
        {modalError ? (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {modalError}
          </div>
        ) : null}
      </StorePanelModal>

      <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Metodos de envio</h2>
            <p className="text-sm text-white/65">Cria metodos e define prazos e custos.</p>
          </div>
          <button
            type="button"
            disabled={!canEdit || !zoneId || savingId !== null}
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            Adicionar metodo
          </button>
        </header>

        {!storeEnabled && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            A loja esta desativada globalmente.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-white/70">
            Zona
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-xs rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Pesquisar metodo"
          />
          {loadingZones ? <span className="text-xs text-white/60">A carregar zonas...</span> : null}
        </div>

        {zones.length === 0 && !loadingZones ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            Cria uma zona antes de adicionar metodos.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {loadingMethods ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            A carregar metodos...
          </div>
        ) : filteredItems.length === 0 && zoneId ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            {methods.length === 0 ? "Sem metodos por agora." : "Sem resultados para a pesquisa."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
            <table className="min-w-full text-sm text-white/80">
              <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left">Metodo</th>
                  <th className="px-4 py-3 text-left">Base</th>
                  <th className="px-4 py-3 text-left">Modo</th>
                  <th className="px-4 py-3 text-left">Gratis</th>
                  <th className="px-4 py-3 text-left">ETA</th>
                  <th className="px-4 py-3 text-left">Default</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{item.name}</div>
                      {item.description ? (
                        <div className="text-[11px] text-white/55">{item.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {item.baseRateCents !== null ? formatCurrencyInput(item.baseRateCents) : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">{methodModeLabel(item.mode)}</td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {item.freeOverCents !== null && item.freeOverCents !== undefined
                        ? formatCurrencyInput(item.freeOverCents)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {formatEta(item.etaMinDays, item.etaMaxDays)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${
                          item.isDefault ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/70"
                        }`}
                      >
                        {item.isDefault ? "Sim" : "Nao"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canEdit || savingId !== null}
                          onClick={() => openEditModal(item)}
                          className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/40 disabled:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit || savingId !== null}
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="rounded-full border border-red-400/50 px-3 py-1 text-xs text-red-100 hover:border-red-300/60 disabled:opacity-60"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDestructiveActionDialog
        open={Boolean(confirmDeleteItem)}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => (confirmDeleteItem ? handleDelete(confirmDeleteItem.id) : undefined)}
        title={confirmDeleteItem ? `Remover ${confirmDeleteItem.name}?` : "Remover metodo"}
        description="Esta acao e permanente."
        consequences={["O metodo deixa de estar disponivel no checkout."]}
        confirmLabel="Remover"
        dangerLevel="high"
      />
    </>
  );
}
