"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type ProductOption = {
  id: number;
  name: string;
  currency: string;
};

type OptionItem = {
  id: number;
  optionType: string;
  label: string;
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  priceDeltaCents: number;
  sortOrder: number;
};

type StoreProductOptionsPanelProps = {
  productsEndpoint: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type OptionFormState = {
  optionType: string;
  label: string;
  required: boolean;
  maxLength: string;
  minValue: string;
  maxValue: string;
  priceDelta: string;
  sortOrder: string;
};

const OPTION_TYPES = ["TEXT", "SELECT", "NUMBER", "CHECKBOX"] as const;

function createEmptyForm(): OptionFormState {
  return {
    optionType: "SELECT",
    label: "",
    required: false,
    maxLength: "",
    minValue: "",
    maxValue: "",
    priceDelta: "",
    sortOrder: "",
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

export default function StoreProductOptionsPanel({
  productsEndpoint,
  storeLocked,
  storeEnabled,
}: StoreProductOptionsPanelProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [items, setItems] = useState<OptionItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<OptionFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const productId = useMemo(() => {
    const parsed = Number(selectedProductId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedProductId]);

  const productCurrency = useMemo(() => {
    if (!productId) return "EUR";
    return products.find((product) => product.id === productId)?.currency ?? "EUR";
  }, [productId, products]);

  const canEdit = storeEnabled && !storeLocked;

  const loadProducts = async () => {
    setLoadingProducts(true);
    setError(null);
    try {
      const res = await fetch(productsEndpoint, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar produtos.");
      }
      const next = Array.isArray(json.items) ? json.items : [];
      setProducts(next);
      if (!selectedProductId && next.length > 0) {
        setSelectedProductId(String(next[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadOptions = async (targetId: number) => {
    setLoadingOptions(true);
    setError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${targetId}/options`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar opcoes.");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [productsEndpoint]);

  useEffect(() => {
    if (productId) {
      void loadOptions(productId);
    } else {
      setItems([]);
    }
  }, [productId, productsEndpoint]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(createEmptyForm());
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: OptionItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      optionType: item.optionType,
      label: item.label,
      required: item.required,
      maxLength: item.maxLength !== null && item.maxLength !== undefined ? String(item.maxLength) : "",
      minValue: item.minValue !== null && item.minValue !== undefined ? String(item.minValue) : "",
      maxValue: item.maxValue !== null && item.maxValue !== undefined ? String(item.maxValue) : "",
      priceDelta: formatCurrencyInput(item.priceDeltaCents),
      sortOrder: String(item.sortOrder ?? 0),
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
    const label = form.label.trim();
    if (!label) {
      return { ok: false as const, error: "Label obrigatoria." };
    }
    const maxLength = form.maxLength.trim() ? Number(form.maxLength) : null;
    if (form.maxLength.trim() && !Number.isFinite(maxLength)) {
      return { ok: false as const, error: "Max length invalido." };
    }
    const minValue = form.minValue.trim() ? Number(form.minValue) : null;
    if (form.minValue.trim() && !Number.isFinite(minValue)) {
      return { ok: false as const, error: "Minimo invalido." };
    }
    const maxValue = form.maxValue.trim() ? Number(form.maxValue) : null;
    if (form.maxValue.trim() && !Number.isFinite(maxValue)) {
      return { ok: false as const, error: "Maximo invalido." };
    }
    const priceDeltaCents = form.priceDelta.trim() ? parseCurrencyInput(form.priceDelta) : 0;
    if (form.priceDelta.trim() && priceDeltaCents === null) {
      return { ok: false as const, error: "Delta de preco invalido." };
    }
    const sortOrder = form.sortOrder.trim() ? Number(form.sortOrder) : null;
    if (form.sortOrder.trim() && !Number.isFinite(sortOrder)) {
      return { ok: false as const, error: "Ordem invalida." };
    }

    return {
      ok: true as const,
      payload: {
        optionType: form.optionType,
        label,
        required: form.required,
        maxLength: maxLength ?? null,
        minValue: minValue ?? null,
        maxValue: maxValue ?? null,
        priceDeltaCents: priceDeltaCents ?? 0,
        sortOrder: sortOrder ?? 0,
      },
    };
  };

  const handleCreate = async () => {
    if (!canEdit || !productId) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(-1);
    setModalError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar opcao.");
      }
      closeModal();
      await loadOptions(productId);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!canEdit || !productId) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(id);
    setModalError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/options/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar opcao.");
      }
      closeModal();
      await loadOptions(productId);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canEdit || !productId) return;
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/options/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover opcao.");
      }
      setItems((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const confirmDeleteItem = useMemo(
    () => items.find((item) => item.id === confirmDeleteId) ?? null,
    [items, confirmDeleteId],
  );

  const modal = (
    <StorePanelModal
      open={modalOpen}
      onClose={closeModal}
      eyebrow={modalMode === "create" ? "Nova opcao" : "Editar opcao"}
      title={modalMode === "create" ? "Personalizacao" : form.label || "Opcao"}
      description="Para opcoes do tipo SELECT, configura os valores na subarea correspondente."
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:border-white/40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (modalMode === "create") {
                void handleCreate();
              } else if (editingId !== null) {
                void handleUpdate(editingId);
              }
            }}
            disabled={!canEdit || savingId !== null || !productId}
            className="rounded-full border border-white/20 bg-white/85 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {savingId !== null
              ? "A guardar..."
              : modalMode === "create"
                ? "Criar opcao"
                : "Guardar alteracoes"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Tipo
            <select
              value={form.optionType}
              onChange={(e) => setForm((prev) => ({ ...prev, optionType: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            >
              {OPTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Label
            <input
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Ex: Nome na camisola"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Delta ({productCurrency})
            <input
              value={form.priceDelta}
              onChange={(e) => setForm((prev) => ({ ...prev, priceDelta: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="0.00"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Ordem (opcional)
            <input
              value={form.sortOrder}
              onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="0"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Max length (texto)
            <input
              type="number"
              value={form.maxLength}
              onChange={(e) => setForm((prev) => ({ ...prev, maxLength: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="32"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Min (numero)
            <input
              type="number"
              value={form.minValue}
              onChange={(e) => setForm((prev) => ({ ...prev, minValue: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Max (numero)
            <input
              type="number"
              value={form.maxValue}
              onChange={(e) => setForm((prev) => ({ ...prev, maxValue: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="99"
            />
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={form.required}
            onChange={(e) => setForm((prev) => ({ ...prev, required: e.target.checked }))}
            className="accent-[#6BFFFF]"
          />
          Opcao obrigatoria
        </label>
      </div>

      {modalError && (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {modalError}
        </div>
      )}
    </StorePanelModal>
  );

  return (
    <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Opcoes de personalizacao</h2>
          <p className="text-sm text-white/65">Campos extra para texto, selecao ou numeros.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null || !productId}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Nova opcao
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar opcoes.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-white/70">
          Produto
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            disabled={loadingProducts}
          >
            <option value="">Seleciona um produto</option>
            {products.map((product) => (
              <option key={product.id} value={String(product.id)}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        {loadingProducts ? <span className="text-xs text-white/60">A carregar produtos...</span> : null}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loadingOptions ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar opcoes...
        </div>
      ) : !productId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Seleciona um produto para gerir opcoes.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Sem opcoes por agora.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Delta</th>
                <th className="px-4 py-3 text-left">Obrigatoria</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-semibold text-white">{item.label}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.optionType}</td>
                  <td className="px-4 py-3 text-xs text-white/70">
                    {formatCurrencyInput(item.priceDeltaCents) || "0.00"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        item.required ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {item.required ? "Sim" : "Nao"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        disabled={!canEdit || savingId !== null}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/40 disabled:opacity-60"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        disabled={!canEdit || savingId !== null}
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

      {modal}

      <ConfirmDestructiveActionDialog
        open={Boolean(confirmDeleteItem)}
        title={confirmDeleteItem ? `Remover ${confirmDeleteItem.label}?` : "Remover opcao"}
        description="Esta acao e permanente."
        consequences={["A opcao deixa de estar disponivel no produto."]}
        confirmLabel="Remover"
        dangerLevel="high"
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteItem) {
            void handleDelete(confirmDeleteItem.id);
          }
          setConfirmDeleteId(null);
        }}
      />
    </section>
  );
}
