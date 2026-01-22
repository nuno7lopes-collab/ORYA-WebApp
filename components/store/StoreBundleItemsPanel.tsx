"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type BundleOption = {
  id: number;
  name: string;
};

type ProductOption = {
  id: number;
  name: string;
};

type VariantOption = {
  id: number;
  label: string;
};

type BundleItem = {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  product?: { name: string; priceCents: number; currency: string };
  variant?: { label: string | null; priceCents: number | null };
};

type StoreBundleItemsPanelProps = {
  bundlesEndpoint: string;
  productsEndpoint: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type BundleItemFormState = {
  productId: string;
  variantId: string;
  quantity: string;
};

function createEmptyForm(): BundleItemFormState {
  return {
    productId: "",
    variantId: "",
    quantity: "1",
  };
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

export default function StoreBundleItemsPanel({
  bundlesEndpoint,
  productsEndpoint,
  storeLocked,
  storeEnabled,
}: StoreBundleItemsPanelProps) {
  const [bundles, setBundles] = useState<BundleOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [items, setItems] = useState<BundleItem[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BundleItemFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const bundleId = useMemo(() => {
    const parsed = Number(selectedBundleId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedBundleId]);

  const canEdit = storeEnabled && !storeLocked;
  const productValid = Number.isFinite(Number(form.productId));
  const quantityValue = form.quantity.trim() ? Number(form.quantity) : 1;
  const quantityValid = Number.isFinite(quantityValue) && quantityValue >= 1;
  const canSubmit = Boolean(bundleId) && productValid && quantityValid;

  const bundleCurrency = items[0]?.product?.currency ?? "EUR";
  const bundleBaseCents = useMemo(
    () =>
      items.reduce((sum, item) => {
        const unit = item.variant?.priceCents ?? item.product?.priceCents ?? 0;
        return sum + unit * item.quantity;
      }, 0),
    [items],
  );

  const renderBadge = (label: string, tone: "required" | "optional") => (
    <span
      className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
        tone === "required"
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
          : "border-white/15 bg-white/5 text-white/50"
      }`}
    >
      {label}
    </span>
  );

  const loadBundles = async () => {
    setLoadingBundles(true);
    setError(null);
    try {
      const res = await fetch(bundlesEndpoint, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar bundles.");
      }
      const next = Array.isArray(json.items) ? json.items : [];
      setBundles(next);
      if (!selectedBundleId && next.length > 0) {
        setSelectedBundleId(String(next[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingBundles(false);
    }
  };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadItems = async (targetBundleId: number) => {
    setLoadingItems(true);
    setError(null);
    try {
      const res = await fetch(`${bundlesEndpoint}/${targetBundleId}/items`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar items.");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingItems(false);
    }
  };

  const loadVariants = async (targetProductId: number) => {
    setLoadingVariants(true);
    setModalError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${targetProductId}/variants`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar variantes.");
      }
      setVariants(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  useEffect(() => {
    void loadBundles();
    void loadProducts();
  }, [bundlesEndpoint, productsEndpoint]);

  useEffect(() => {
    if (bundleId) {
      void loadItems(bundleId);
    } else {
      setItems([]);
    }
  }, [bundleId, bundlesEndpoint]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(createEmptyForm());
    setVariants([]);
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: BundleItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    const nextProductId = String(item.productId);
    setForm({
      productId: nextProductId,
      variantId: item.variantId ? String(item.variantId) : "",
      quantity: String(item.quantity),
    });
    setModalError(null);
    setModalOpen(true);
    void loadVariants(item.productId);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalError(null);
    setEditingId(null);
  };

  const handleProductChange = (value: string) => {
    setForm((prev) => ({ ...prev, productId: value, variantId: "" }));
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      void loadVariants(parsed);
    } else {
      setVariants([]);
    }
  };

  const buildPayload = () => {
    const productId = Number(form.productId);
    if (!Number.isFinite(productId)) {
      return { ok: false as const, error: "Produto obrigatorio." };
    }
    const quantity = form.quantity.trim() ? Number(form.quantity) : 1;
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false as const, error: "Quantidade invalida." };
    }
    const variantId = form.variantId ? Number(form.variantId) : null;
    if (form.variantId && !Number.isFinite(variantId)) {
      return { ok: false as const, error: "Variante invalida." };
    }

    return {
      ok: true as const,
      payload: {
        productId,
        variantId: variantId ?? null,
        quantity,
      },
    };
  };

  const handleCreate = async () => {
    if (!canEdit || !bundleId) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(-1);
    setModalError(null);
    try {
      const res = await fetch(`${bundlesEndpoint}/${bundleId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar item.");
      }
      closeModal();
      await loadItems(bundleId);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!canEdit || !bundleId) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(id);
    setModalError(null);
    try {
      const res = await fetch(`${bundlesEndpoint}/${bundleId}/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar item.");
      }
      closeModal();
      await loadItems(bundleId);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canEdit || !bundleId) return;
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`${bundlesEndpoint}/${bundleId}/items/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover item.");
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
      eyebrow={modalMode === "create" ? "Novo item" : "Editar item"}
      title={modalMode === "create" ? "Item do bundle" : "Item"}
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
            disabled={!canEdit || savingId !== null || !canSubmit}
            className="rounded-full border border-white/20 bg-white/85 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {savingId !== null
              ? "A guardar..."
              : modalMode === "create"
                ? "Adicionar item"
                : "Guardar alteracoes"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Produto {renderBadge("Obrigatorio", "required")}
            <select
              value={form.productId}
              onChange={(e) => handleProductChange(e.target.value)}
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
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Variante {renderBadge("Opcional", "optional")}
            <select
              value={form.variantId}
              onChange={(e) => setForm((prev) => ({ ...prev, variantId: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              disabled={!form.productId || loadingVariants}
            >
              <option value="">Sem variante</option>
              {variants.map((variant) => (
                <option key={variant.id} value={String(variant.id)}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex w-[140px] flex-col gap-1 text-xs text-white/70">
          Quantidade {renderBadge("Obrigatorio", "required")}
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="1"
          />
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
          <h2 className="text-lg font-semibold text-white">Items do bundle</h2>
          <p className="text-sm text-white/65">Associa produtos e variantes aos bundles.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null || !bundleId}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Novo item
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar items.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-white/70">
          Bundle {renderBadge("Obrigatorio", "required")}
          <select
            value={selectedBundleId}
            onChange={(e) => setSelectedBundleId(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            disabled={loadingBundles}
          >
            <option value="">Seleciona um bundle</option>
            {bundles.map((bundle) => (
              <option key={bundle.id} value={String(bundle.id)}>
                {bundle.name}
              </option>
            ))}
          </select>
        </label>
        {loadingBundles ? <span className="text-xs text-white/60">A carregar bundles...</span> : null}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loadingItems ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar items...
        </div>
      ) : !bundleId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Seleciona um bundle para gerir items.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Sem items por agora.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Qtd. no bundle</th>
                <th className="px-4 py-3 text-left">Preco base</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{item.product?.name ?? "Produto"}</div>
                    <div className="text-[11px] text-white/45">
                      {item.variant?.label ? `Variante: ${item.variant.label}` : "Sem variante"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.quantity}</td>
                  <td className="px-4 py-3 text-xs text-white/70">
                    {formatMoney(item.variant?.priceCents ?? item.product?.priceCents ?? 0, bundleCurrency)}
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

      {bundleId && items.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Total base dos itens</span>
            <span className="font-semibold text-white">{formatMoney(bundleBaseCents, bundleCurrency)}</span>
          </div>
        </div>
      ) : null}

      {modal}

      <ConfirmDestructiveActionDialog
        open={Boolean(confirmDeleteItem)}
        title={confirmDeleteItem ? "Remover item?" : "Remover item"}
        description="Esta acao e permanente."
        consequences={["O item deixa de fazer parte do bundle."]}
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
