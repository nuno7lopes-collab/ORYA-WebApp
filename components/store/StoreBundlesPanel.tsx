"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StorePanelModal from "@/components/store/StorePanelModal";

type BundleItem = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  pricingMode: string;
  priceCents: number | null;
  percentOff: number | null;
  status: string;
  isVisible: boolean;
};

type StoreBundlesPanelProps = {
  endpointBase: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type BundleFormState = {
  name: string;
  slug: string;
  description: string;
  pricingMode: string;
  price: string;
  percentOff: string;
  status: string;
  isVisible: boolean;
};

const PRICING_MODES = ["FIXED", "PERCENT_DISCOUNT"] as const;
const STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

function createEmptyForm(): BundleFormState {
  return {
    name: "",
    slug: "",
    description: "",
    pricingMode: "FIXED",
    price: "",
    percentOff: "",
    status: "DRAFT",
    isVisible: false,
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

export default function StoreBundlesPanel({
  endpointBase,
  storeLocked,
  storeEnabled,
}: StoreBundlesPanelProps) {
  const [items, setItems] = useState<BundleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BundleFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const canEdit = storeEnabled && !storeLocked;
  const nameValid = form.name.trim().length > 0;
  const priceValid =
    form.pricingMode === "FIXED"
      ? parseCurrencyInput(form.price) !== null
      : Number.isFinite(form.percentOff.trim() ? Number(form.percentOff) : NaN);
  const canSubmit = nameValid && priceValid;

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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpointBase, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar bundles.");
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
    return items.filter((item) => [item.name, item.slug].join(" ").toLowerCase().includes(term));
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

  const openEditModal = (item: BundleItem) => {
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
      pricingMode: item.pricingMode,
      price: formatCurrencyInput(item.priceCents),
      percentOff: item.percentOff !== null && item.percentOff !== undefined ? String(item.percentOff) : "",
      status: item.status,
      isVisible: item.isVisible,
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
    const priceCents = parseCurrencyInput(form.price);
    const percentOff = form.percentOff.trim() ? Number(form.percentOff) : null;
    if (form.pricingMode === "FIXED" && priceCents === null) {
      return { ok: false as const, error: "Preco invalido." };
    }
    if (form.pricingMode === "PERCENT_DISCOUNT") {
      if (!Number.isFinite(percentOff) || percentOff === null) {
        return { ok: false as const, error: "Percentagem invalida." };
      }
    }

    return {
      ok: true as const,
      payload: {
        name,
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        pricingMode: form.pricingMode,
        priceCents: form.pricingMode === "FIXED" ? priceCents : null,
        percentOff: form.pricingMode === "PERCENT_DISCOUNT" ? percentOff : null,
        status: form.status,
        isVisible: form.isVisible,
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
        throw new Error(json?.error || "Erro ao criar bundle.");
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
        throw new Error(json?.error || "Erro ao atualizar bundle.");
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
        throw new Error(json?.error || "Erro ao remover bundle.");
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
      eyebrow={modalMode === "create" ? "Novo bundle" : "Editar bundle"}
      title={modalMode === "create" ? "Bundle / Pack" : form.name || "Bundle"}
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
                ? "Criar bundle"
                : "Guardar alteracoes"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Nome {renderBadge("Obrigatorio", "required")}
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Pack 3 camisolas"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Slug {renderBadge("Opcional", "optional")}
            <input
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="pack-camisolas"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Pricing {renderBadge("Obrigatorio", "required")}
            <select
              value={form.pricingMode}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  pricingMode: e.target.value,
                  price: "",
                  percentOff: "",
                }))
              }
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            >
              {PRICING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          {form.pricingMode === "FIXED" ? (
            <label className="flex flex-col gap-1 text-xs text-white/70">
              Preco (EUR) {renderBadge("Obrigatorio", "required")}
              <input
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="49.90"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-xs text-white/70">
              Desconto (%) {renderBadge("Obrigatorio", "required")}
              <input
                type="number"
                value={form.percentOff}
                onChange={(e) => setForm((prev) => ({ ...prev, percentOff: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="10"
              />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1 text-xs text-white/70">
          Descricao {renderBadge("Opcional", "optional")}
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-[80px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Descricao do bundle"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Status {renderBadge("Opcional", "optional")}
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={form.isVisible}
              onChange={(e) => setForm((prev) => ({ ...prev, isVisible: e.target.checked }))}
              className="accent-[#6BFFFF]"
            />
            <span>
              Visivel na loja {renderBadge("Opcional", "optional")}
            </span>
          </label>
        </div>
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
          <h2 className="text-lg font-semibold text-white">Bundles / Packs</h2>
          <p className="text-sm text-white/65">Define packs com preco fixo ou desconto percentual.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Novo bundle
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar bundles.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-xs rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white outline-none focus:border-white/40"
          placeholder="Pesquisar bundle"
        />
        <span className="text-xs text-white/60">
          {searchTerm
            ? `${filteredItems.length} de ${items.length} bundles`
            : `${items.length} bundles`}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar bundles...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          {items.length === 0 ? "Sem bundles por agora." : "Sem resultados para a pesquisa."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Bundle</th>
                <th className="px-4 py-3 text-left">Pricing</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Visivel</th>
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
                  <td className="px-4 py-3 text-xs text-white/70">{item.pricingMode}</td>
                  <td className="px-4 py-3 text-xs text-white/70">
                    {item.pricingMode === "FIXED"
                      ? formatCurrencyInput(item.priceCents) || "0.00"
                      : `${item.percentOff ?? 0}%`}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        item.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-100"
                          : item.status === "ARCHIVED"
                            ? "bg-rose-500/20 text-rose-100"
                            : "bg-white/10 text-white/70"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70">{item.isVisible ? "Sim" : "Nao"}</td>
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
        title={confirmDeleteItem ? `Remover ${confirmDeleteItem.name}?` : "Remover bundle"}
        description="Esta acao e permanente."
        consequences={["O bundle deixa de estar disponivel na loja."]}
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
