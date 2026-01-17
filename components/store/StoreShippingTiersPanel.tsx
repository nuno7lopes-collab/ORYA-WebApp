"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type ZoneOption = {
  id: number;
  name: string;
};

type MethodOption = {
  id: number;
  name: string;
};

type TierItem = {
  id: number;
  methodId: number;
  minSubtotalCents: number | null;
  maxSubtotalCents: number | null;
  rateCents: number | null;
};

type StoreShippingTiersPanelProps = {
  zonesEndpoint: string;
  storeEnabled: boolean;
};

type TierFormState = {
  minSubtotal: string;
  maxSubtotal: string;
  rate: string;
};

function createEmptyForm(): TierFormState {
  return {
    minSubtotal: "",
    maxSubtotal: "",
    rate: "",
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

export default function StoreShippingTiersPanel({
  zonesEndpoint,
  storeEnabled,
}: StoreShippingTiersPanelProps) {
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [methods, setMethods] = useState<MethodOption[]>([]);
  const [tiers, setTiers] = useState<TierItem[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TierFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const canEdit = storeEnabled;

  const zoneId = useMemo(() => {
    const parsed = Number(selectedZoneId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedZoneId]);

  const methodId = useMemo(() => {
    const parsed = Number(selectedMethodId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedMethodId]);

  const methodsBase = zonesEndpoint.replace(/\/zones$/, "") + "/methods";
  const tiersBase = zonesEndpoint.replace(/\/zones$/, "") + "/tiers";

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
      const next = Array.isArray(json.items) ? json.items : [];
      setMethods(next);
      if (next.length === 0) {
        setSelectedMethodId("");
      } else if (!next.some((item: MethodOption) => String(item.id) === selectedMethodId)) {
        setSelectedMethodId(String(next[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingMethods(false);
    }
  };

  const loadTiers = async (targetMethodId: number) => {
    setLoadingTiers(true);
    setError(null);
    try {
      const res = await fetch(`${methodsBase}/${targetMethodId}/tiers`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar tiers.");
      }
      setTiers(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingTiers(false);
    }
  };

  useEffect(() => {
    void loadZones();
  }, [zonesEndpoint]);

  useEffect(() => {
    if (!zoneId) {
      setMethods([]);
      setSelectedMethodId("");
      return;
    }
    void loadMethods(zoneId);
  }, [zoneId]);

  useEffect(() => {
    if (!methodId) {
      setTiers([]);
      return;
    }
    void loadTiers(methodId);
  }, [methodId]);

  const confirmDeleteItem = useMemo(
    () => tiers.find((item) => item.id === confirmDeleteId) ?? null,
    [tiers, confirmDeleteId],
  );

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(createEmptyForm());
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: TierItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      minSubtotal: formatCurrencyInput(item.minSubtotalCents),
      maxSubtotal: formatCurrencyInput(item.maxSubtotalCents),
      rate: formatCurrencyInput(item.rateCents),
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
    const minSubtotalCents = parseCurrencyInput(form.minSubtotal);
    const maxSubtotalCents = parseCurrencyInput(form.maxSubtotal);
    const rateCents = parseCurrencyInput(form.rate);
    if (minSubtotalCents === null || rateCents === null) {
      return { ok: false as const, error: "Valores invalidos." };
    }
    if (maxSubtotalCents !== null && maxSubtotalCents < minSubtotalCents) {
      return { ok: false as const, error: "Intervalo invalido." };
    }

    return {
      ok: true as const,
      payload: {
        minSubtotalCents,
        maxSubtotalCents: maxSubtotalCents ?? null,
        rateCents,
      },
    };
  };

  const handleCreate = async () => {
    if (!canEdit || !methodId) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(-1);
    setModalError(null);
    try {
      const res = await fetch(`${methodsBase}/${methodId}/tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar tier.");
      }
      setTiers((prev) => [json.item, ...prev]);
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
      const res = await fetch(`${tiersBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar tier.");
      }
      setTiers((prev) => prev.map((entry) => (entry.id === id ? json.item : entry)));
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
      const res = await fetch(`${tiersBase}/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover tier.");
      }
      setTiers((prev) => prev.filter((entry) => entry.id !== id));
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
        eyebrow={modalMode === "create" ? "Novo tier" : "Editar tier"}
        title={modalMode === "create" ? "Escalao de envio" : "Escalao"}
        description="Define intervalos de subtotal para metodos com tiers."
        size="md"
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
                  ? "Criar escalao"
                  : "Guardar alteracoes"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Min subtotal
            <input
              value={form.minSubtotal}
              onChange={(e) => setForm((prev) => ({ ...prev, minSubtotal: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="0.00"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Max subtotal (opcional)
            <input
              value={form.maxSubtotal}
              onChange={(e) => setForm((prev) => ({ ...prev, maxSubtotal: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder=""
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Rate
            <input
              value={form.rate}
              onChange={(e) => setForm((prev) => ({ ...prev, rate: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="0.00"
            />
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
            <h2 className="text-lg font-semibold text-white">Tabelas de portes</h2>
            <p className="text-sm text-white/65">Define escaloes por subtotal para metodos com tiers.</p>
          </div>
          <button
            type="button"
            disabled={!canEdit || !methodId || savingId !== null}
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            Adicionar escalao
          </button>
        </header>

        {!storeEnabled && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            A loja esta desativada globalmente.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-white/70">
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
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-white/70">
            Metodo
            <select
              value={selectedMethodId}
              onChange={(e) => setSelectedMethodId(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            >
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>
          {loadingZones || loadingMethods ? (
            <span className="text-xs text-white/60">A carregar...</span>
          ) : null}
        </div>

        {zones.length === 0 && !loadingZones ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            Cria uma zona antes de adicionar tabelas.
          </div>
        ) : null}

        {methods.length === 0 && zoneId && !loadingMethods ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            Cria um metodo antes de adicionar tabelas.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {loadingTiers ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            A carregar tiers...
          </div>
        ) : tiers.length === 0 && methodId ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            Sem escaloes por agora.
          </div>
        ) : tiers.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
            <table className="min-w-full text-sm text-white/80">
              <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left">Intervalo</th>
                  <th className="px-4 py-3 text-left">Rate</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-4 py-3 text-xs text-white/70">
                      {formatCurrencyInput(item.minSubtotalCents)} - {item.maxSubtotalCents !== null ? formatCurrencyInput(item.maxSubtotalCents) : "+"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {item.rateCents !== null ? formatCurrencyInput(item.rateCents) : "-"}
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
        ) : null}
      </section>

      <ConfirmDestructiveActionDialog
        open={Boolean(confirmDeleteItem)}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => (confirmDeleteItem ? handleDelete(confirmDeleteItem.id) : undefined)}
        title="Remover escalao?"
        description="Esta acao e permanente."
        consequences={["O intervalo deixa de estar disponivel."]}
        confirmLabel="Remover"
        dangerLevel="high"
      />
    </>
  );
}
