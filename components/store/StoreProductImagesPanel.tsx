"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StoreImageCropperModal from "@/components/store/StoreImageCropperModal";
import StorePanelModal from "@/components/store/StorePanelModal";

type ProductOption = {
  id: number;
  name: string;
};

type ImageItem = {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

type StoreProductImagesPanelProps = {
  productsEndpoint: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type ImageFormState = {
  url: string;
  altText: string;
  sortOrder: string;
  isPrimary: boolean;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function createEmptyForm(): ImageFormState {
  return {
    url: "",
    altText: "",
    sortOrder: "",
    isPrimary: false,
  };
}

export default function StoreProductImagesPanel({
  productsEndpoint,
  storeLocked,
  storeEnabled,
}: StoreProductImagesPanelProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [items, setItems] = useState<ImageItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ImageFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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

  const loadImages = async (targetId: number) => {
    setLoadingImages(true);
    setError(null);
    try {
      const res = await fetch(`${productsEndpoint}/${targetId}/images`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar imagens.");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingImages(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [productsEndpoint]);

  useEffect(() => {
    if (productId) {
      void loadImages(productId);
    } else {
      setItems([]);
    }
  }, [productId, productsEndpoint]);

  const handleUpload = async (file: File) => {
    if (!canEdit) return;
    setUploading(true);
    setModalError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=store-product", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Erro no upload da imagem.");
      }
      setForm((prev) => ({ ...prev, url: json.url }));
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setUploading(false);
    }
  };

  const closeCropper = () => {
    setCropOpen(false);
    setCropFile(null);
  };

  const handleSelectUpload = (file: File | null) => {
    if (!file || !canEdit) return;
    if (!file.type.startsWith("image/")) {
      setModalError("Formato de imagem invalido.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setModalError("Imagem demasiado grande. Maximo 5MB.");
      return;
    }
    setModalError(null);
    setCropFile(file);
    setCropOpen(true);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(createEmptyForm());
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: ImageItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      url: item.url,
      altText: item.altText ?? "",
      sortOrder: String(item.sortOrder ?? 0),
      isPrimary: item.isPrimary,
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
    const url = form.url.trim();
    if (!url) {
      return { ok: false as const, error: "URL obrigatoria." };
    }
    const sortOrderValue = form.sortOrder.trim() ? Number(form.sortOrder) : null;
    if (form.sortOrder.trim() && !Number.isFinite(sortOrderValue)) {
      return { ok: false as const, error: "Ordem invalida." };
    }

    return {
      ok: true as const,
      payload: {
        url,
        altText: form.altText.trim() || null,
        sortOrder: sortOrderValue ?? 0,
        isPrimary: form.isPrimary,
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
      const res = await fetch(`${productsEndpoint}/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar imagem.");
      }
      closeModal();
      await loadImages(productId);
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
      const res = await fetch(`${productsEndpoint}/${productId}/images/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar imagem.");
      }
      closeModal();
      await loadImages(productId);
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
      const res = await fetch(`${productsEndpoint}/${productId}/images/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover imagem.");
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
      eyebrow={modalMode === "create" ? "Nova imagem" : "Editar imagem"}
      title={modalMode === "create" ? "Imagem do produto" : form.altText || "Imagem"}
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
                ? "Adicionar imagem"
                : "Guardar alteracoes"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-[1.3fr,1fr]">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            URL da imagem
            <input
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="https://..."
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Upload direto
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelectUpload(file);
                if (uploadInputRef.current) uploadInputRef.current.value = "";
              }}
              disabled={!canEdit || uploading}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white file:mr-3 file:rounded-full file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white/80"
            />
          </label>
        </div>
        <p className="text-[11px] text-white/50">As imagens enviadas sao recortadas a 1:1.</p>

        {form.url ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
            <img src={form.url} alt={form.altText || "Preview"} className="h-16 w-16 rounded-xl object-cover" />
            <p className="text-xs text-white/60">Preview da imagem</p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Alt (opcional)
            <input
              value={form.altText}
              onChange={(e) => setForm((prev) => ({ ...prev, altText: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Descricao curta"
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
            checked={form.isPrimary}
            onChange={(e) => setForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
            className="accent-[#6BFFFF]"
          />
          Marcar como primaria
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
          <h2 className="text-lg font-semibold text-white">Imagens de produto</h2>
          <p className="text-sm text-white/65">Carrega imagens e define a primaria por produto.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null || !productId}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Nova imagem
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar imagens.
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

      {loadingImages ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar imagens...
        </div>
      ) : !productId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Seleciona um produto para gerir imagens.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Sem imagens por agora.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Imagem</th>
                <th className="px-4 py-3 text-left">Alt</th>
                <th className="px-4 py-3 text-left">Ordem</th>
                <th className="px-4 py-3 text-left">Primaria</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={item.url} alt={item.altText ?? "Imagem"} className="h-12 w-12 rounded-xl object-cover" />
                      <div>
                        <p className="text-xs text-white/70">{item.url}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.altText ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.sortOrder}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-[11px] ${item.isPrimary ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/70"}`}>
                      {item.isPrimary ? "Sim" : "Nao"}
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

      <StoreImageCropperModal
        open={cropOpen}
        file={cropFile}
        title="Recortar imagem"
        description="Formato 1:1. Ajusta antes de enviar."
        onClose={closeCropper}
        onConfirm={(cropped) => {
          closeCropper();
          void handleUpload(cropped);
        }}
      />

      <ConfirmDestructiveActionDialog
        open={Boolean(confirmDeleteItem)}
        title={confirmDeleteItem ? "Remover imagem?" : "Remover imagem"}
        description="Esta acao e permanente."
        consequences={["A imagem deixa de estar associada ao produto."]}
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
