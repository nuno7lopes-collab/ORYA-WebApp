"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type ProductOption = {
  id: number;
  name: string;
  currency: string;
};

type VariantItem = {
  id: number;
  label: string;
  sku: string | null;
  priceCents: number | null;
  stockQty: number | null;
  isActive: boolean;
  sortOrder: number;
};

type StoreProductVariantsPanelProps = {
  productsEndpoint: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type VariantFormState = {
  label: string;
  sku: string;
  price: string;
  stockQty: string;
  isActive: boolean;
  sortOrder: string;
};

function createEmptyForm(): VariantFormState {
  return {
    label: "",
    sku: "",
    price: "",
    stockQty: "",
    isActive: true,
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

export default function StoreProductVariantsPanel({
  productsEndpoint,
  storeLocked,
  storeEnabled,
}: StoreProductVariantsPanelProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [items, setItems] = useState<VariantItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VariantFormState>(createEmptyForm());
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

  const loadVariants = async (targetId: number) => {
    setLoadingVariants(true);
    setError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${targetId}/variants`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar variantes.");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingVariants(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [productsEndpoint]);

  useEffect(() => {
    if (productId) {
      void loadVariants(productId);
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

  const openEditModal = (item: VariantItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      label: item.label,
      sku: item.sku ?? "",
      price: formatCurrencyInput(item.priceCents),
      stockQty: item.stockQty !== null && item.stockQty !== undefined ? String(item.stockQty) : "",
      isActive: item.isActive,
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
    const priceCents = form.price.trim() ? parseCurrencyInput(form.price) : null;
    if (form.price.trim() && priceCents === null) {
      return { ok: false as const, error: "Preco invalido." };
    }
    const stockQty = form.stockQty.trim() ? Number(form.stockQty) : null;
    if (form.stockQty.trim() && (!Number.isFinite(stockQty) || (stockQty ?? 0) < 0)) {
      return { ok: false as const, error: "Stock invalido." };
    }
    const sortOrder = form.sortOrder.trim() ? Number(form.sortOrder) : null;
    if (form.sortOrder.trim() && !Number.isFinite(sortOrder)) {
      return { ok: false as const, error: "Ordem invalida." };
    }

    return {
      ok: true as const,
      payload: {
        label,
        sku: form.sku.trim() || null,
        priceCents: priceCents ?? null,
        stockQty: stockQty ?? null,
        isActive: form.isActive,
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
      const res = await fetch(`${productsEndpoint}/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar variante.");
      }
      closeModal();
      await loadVariants(productId);
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
      const res = await fetch(`${productsEndpoint}/${productId}/variants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar variante.");
      }
      closeModal();
      await loadVariants(productId);
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
      const res = await fetch(`${productsEndpoint}/${productId}/variants/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover variante.");
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
      eyebrow={modalMode === "create" ? "Nova variante" : "Editar variante"}
      title={modalMode === "create" ? "Detalhes da variante" : form.label || "Variante"}
      size="md"
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
                ? "Criar variante"
                : "Guardar alteracoes"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="flex flex-col gap-1 text-xs text-white/70">
          Label
          <input
            value={form.label}
            onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Ex: Tamanho M"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            SKU (opcional)
            <input
              value={form.sku}
              onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="SKU-001"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Preco ({productCurrency})
            <input
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Opcional"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Stock (opcional)
            <input
              value={form.stockQty}
              onChange={(e) => setForm((prev) => ({ ...prev, stockQty: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="0"
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

        <label className="inline-flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            className="accent-[#6BFFFF]"
          />
          Variante ativa
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
          <h2 className="text-lg font-semibold text-white">Variantes</h2>
          <p className="text-sm text-white/65">Define tamanhos e variacoes para cada produto.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null || !productId}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Nova variante
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar variantes.
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

      {loadingVariants ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar variantes...
        </div>
      ) : !productId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Seleciona um produto para gerir variantes.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Sem variantes por agora.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Preco</th>
                <th className="px-4 py-3 text-left">Stock</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-semibold text-white">{item.label}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.sku ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-white/70">
                    {item.priceCents !== null ? formatCurrencyInput(item.priceCents) : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.stockQty ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        item.isActive ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {item.isActive ? "Ativa" : "Inativa"}
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
        title={confirmDeleteItem ? `Remover ${confirmDeleteItem.label}?` : "Remover variante"}
        description="Esta acao e permanente."
        consequences={["A variante deixa de estar disponivel no produto."]}
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
