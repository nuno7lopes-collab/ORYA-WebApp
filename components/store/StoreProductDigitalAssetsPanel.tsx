"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type ProductOption = {
  id: number;
  name: string;
};

type AssetItem = {
  id: number;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  maxDownloads: number | null;
  maxDownloadsInput: string;
  isActive: boolean;
  createdAt: string;
};

type StoreProductDigitalAssetsPanelProps = {
  productsEndpoint: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type AssetFormState = {
  file: File | null;
  filename: string;
  maxDownloads: string;
  isActive: boolean;
};

function createEmptyForm(): AssetFormState {
  return {
    file: null,
    filename: "",
    maxDownloads: "",
    isActive: true,
  };
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function StoreProductDigitalAssetsPanel({
  productsEndpoint,
  storeLocked,
  storeEnabled,
}: StoreProductDigitalAssetsPanelProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const productId = useMemo(() => {
    const parsed = Number(selectedProductId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedProductId]);

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

  const loadAssets = async (targetId: number) => {
    setLoadingAssets(true);
    setError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${targetId}/digital-assets`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar ficheiros.");
      }
      const next: AssetItem[] = Array.isArray(json.items)
        ? json.items.map((item: Omit<AssetItem, "maxDownloadsInput">) => ({
            ...item,
            maxDownloadsInput: item.maxDownloads ? String(item.maxDownloads) : "",
          }))
        : [];
      setItems(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [productsEndpoint]);

  useEffect(() => {
    if (productId) {
      void loadAssets(productId);
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

  const openEditModal = (item: AssetItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      file: null,
      filename: item.filename,
      maxDownloads: item.maxDownloadsInput,
      isActive: item.isActive,
    });
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalError(null);
    setEditingId(null);
  };

  const parseMaxDownloads = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    return Math.floor(parsed);
  };

  const handleCreate = async () => {
    if (!canEdit || !productId || !form.file) return;
    setUploading(true);
    setModalError(null);
    try {
      const formData = new FormData();
      formData.append("file", form.file);
      if (form.maxDownloads.trim()) {
        formData.append("maxDownloads", form.maxDownloads.trim());
      }
      formData.append("isActive", form.isActive ? "true" : "false");
      const res = await fetch(`${productsEndpoint}/${productId}/digital-assets`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar ficheiro.");
      }
      closeModal();
      await loadAssets(productId);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!canEdit || !productId) return;
    const maxDownloads = parseMaxDownloads(form.maxDownloads);
    if (form.maxDownloads.trim() && maxDownloads === null) {
      setModalError("Max downloads invalido.");
      return;
    }
    setSavingId(id);
    setModalError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/digital-assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: form.filename.trim() || undefined,
          maxDownloads,
          isActive: form.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar ficheiro.");
      }
      closeModal();
      await loadAssets(productId);
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
      const res = await fetch(`${productsEndpoint}/${productId}/digital-assets/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover ficheiro.");
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
      eyebrow={modalMode === "create" ? "Novo ficheiro" : "Editar ficheiro"}
      title={modalMode === "create" ? "Ficheiro digital" : form.filename || "Ficheiro"}
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
            disabled={!canEdit || savingId !== null || (!form.file && modalMode === "create")}
            className="rounded-full border border-white/20 bg-white/85 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {uploading || savingId !== null
              ? "A guardar..."
              : modalMode === "create"
                ? "Adicionar ficheiro"
                : "Guardar alteracoes"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        {modalMode === "create" ? (
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Ficheiro
            <input
              type="file"
              onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              disabled={!canEdit || uploading}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Nome
            <input
              value={form.filename}
              onChange={(e) => setForm((prev) => ({ ...prev, filename: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Nome do ficheiro"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-white/70">
          Max downloads (opcional)
          <input
            value={form.maxDownloads}
            onChange={(e) => setForm((prev) => ({ ...prev, maxDownloads: e.target.value }))}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Sem limite"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            className="accent-[#6BFFFF]"
          />
          Ficheiro ativo
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
          <h2 className="text-lg font-semibold text-white">Ficheiros digitais</h2>
          <p className="text-sm text-white/65">
            Carrega ficheiros para produtos digitais. Para entrega digital, define &quot;Requer envio&quot; como falso no produto.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null || !productId}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Novo ficheiro
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar ficheiros.
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

      {loadingAssets ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar ficheiros...
        </div>
      ) : !productId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Seleciona um produto para gerir ficheiros digitais.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Sem ficheiros digitais por agora.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Ficheiro</th>
                <th className="px-4 py-3 text-left">Tamanho</th>
                <th className="px-4 py-3 text-left">Max downloads</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{item.filename}</div>
                    <div className="text-[11px] text-white/45">{item.mimeType}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70">{formatSize(item.sizeBytes)}</td>
                  <td className="px-4 py-3 text-xs text-white/70">
                    {item.maxDownloads ? item.maxDownloads : "Sem limite"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        item.isActive ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {item.isActive ? "Ativo" : "Inativo"}
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
        title={confirmDeleteItem ? `Remover ${confirmDeleteItem.filename}?` : "Remover ficheiro"}
        description="Esta acao e permanente."
        consequences={["O ficheiro deixa de estar disponivel para download."]}
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
