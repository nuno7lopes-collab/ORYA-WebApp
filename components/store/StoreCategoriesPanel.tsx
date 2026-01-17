"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type CategoryItem = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  coverImageUrl?: string | null;
};

type StoreCategoriesPanelProps = {
  endpointBase: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  coverImageUrl: string;
  isActive: boolean;
};

function createEmptyForm(): CategoryFormState {
  return {
    name: "",
    slug: "",
    description: "",
    sortOrder: "",
    coverImageUrl: "",
    isActive: true,
  };
}

export default function StoreCategoriesPanel({
  endpointBase,
  storeLocked,
  storeEnabled,
}: StoreCategoriesPanelProps) {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CategoryFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const canEdit = storeEnabled && !storeLocked;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpointBase, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar categorias.");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [endpointBase]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.name, item.slug].join(" ").toLowerCase().includes(term),
    );
  }, [items, searchTerm]);

  const confirmDeleteItem = useMemo(
    () => items.find((item) => item.id === confirmDeleteId) ?? null,
    [items, confirmDeleteId],
  );

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(createEmptyForm());
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: CategoryItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
      sortOrder: String(item.sortOrder ?? 0),
      coverImageUrl: item.coverImageUrl ?? "",
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

  const buildPayload = () => {
    const name = form.name.trim();
    if (!name) {
      return { ok: false as const, error: "Nome obrigatorio." };
    }
    const sortOrder = form.sortOrder.trim() ? Number(form.sortOrder) : null;
    if (form.sortOrder.trim() && !Number.isFinite(sortOrder)) {
      return { ok: false as const, error: "Ordem invalida." };
    }

    return {
      ok: true as const,
      payload: {
        name,
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || null,
        sortOrder: sortOrder ?? undefined,
        coverImageUrl: form.coverImageUrl.trim() || null,
        isActive: form.isActive,
      },
    };
  };

  const handleCreate = async () => {
    if (!canEdit) return;
    const result = buildPayload();
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setSavingId(-1);
    setModalError(null);
    try {
      const res = await fetch(endpointBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar categoria.");
      }
      setItems((prev) => [json.item, ...prev]);
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
      const res = await fetch(`${endpointBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar categoria.");
      }
      setItems((prev) => prev.map((entry) => (entry.id === id ? json.item : entry)));
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
      const res = await fetch(`${endpointBase}/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover categoria.");
      }
      setItems((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const modal = (
    <StorePanelModal
      open={modalOpen}
      onClose={closeModal}
      eyebrow={modalMode === "create" ? "Nova categoria" : "Editar categoria"}
      title={modalMode === "create" ? "Detalhes da categoria" : form.name || "Categoria"}
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
            disabled={!canEdit || savingId !== null}
            className="rounded-full border border-white/20 bg-white/85 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {savingId !== null
              ? "A guardar..."
              : modalMode === "create"
                ? "Criar categoria"
                : "Guardar alteracoes"}
          </button>
        </>
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
              placeholder="Ex: Merch"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Slug (opcional)
            <input
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="merch"
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
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Capa (URL opcional)
            <input
              value={form.coverImageUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="https://..."
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-white/70">
          Descricao (opcional)
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-[80px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Descricao curta da categoria."
          />
        </label>

        <label className="inline-flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            className="accent-[#6BFFFF]"
          />
          Categoria ativa
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
          <h2 className="text-lg font-semibold text-white">Categorias</h2>
          <p className="text-sm text-white/65">Organiza o catalogo por temas e colecoes.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Nova categoria
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar categorias.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-xs rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white outline-none focus:border-white/40"
          placeholder="Pesquisar categoria"
        />
        <span className="text-xs text-white/60">
          {searchTerm
            ? `${filteredItems.length} de ${items.length} categorias`
            : `${items.length} categorias`}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar categorias...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          {items.length === 0 ? "Sem categorias por agora." : "Sem resultados para a pesquisa."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-left">Ordem</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{item.name}</div>
                    {item.description ? (
                      <div className="text-[11px] text-white/45">{item.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.slug}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.sortOrder}</td>
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
        title={confirmDeleteItem ? `Remover ${confirmDeleteItem.name}?` : "Remover categoria"}
        description="Esta acao e permanente."
        consequences={["A categoria deixa de aparecer no catalogo."]}
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
