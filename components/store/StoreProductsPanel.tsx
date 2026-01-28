"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import StoreImageCropperModal from "@/components/store/StoreImageCropperModal";
import StorePanelModal from "@/components/store/StorePanelModal";

type CategoryOption = {
  id: number;
  name: string;
};

type ProductItem = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  sku: string | null;
  status: string;
  isVisible: boolean;
  categoryId: number | null;
  requiresShipping: boolean;
  stockPolicy: string;
  stockQty: number | null;
};

type VariantItem = {
  id: number;
  label: string;
  stockQty: number | null;
};

type OptionItem = {
  id: number;
  optionType: string;
  label: string;
  priceDeltaCents: number;
};

type StoreProductsPanelProps = {
  endpointBase: string;
  categoriesEndpoint: string;
  storeLocked: boolean;
  storeEnabled: boolean;
};

type ProductFormState = {
  name: string;
  price: string;
  categoryId: string;
  productType: "physical" | "digital";
  shortDescription: string;
  description: string;
  sku: string;
  compareAtPrice: string;
  stockTracked: boolean;
  stockQty: string;
  publish: boolean;
  sizeSelections: SizeSelection[];
  personalizationEnabled: boolean;
  personalizationLabel: string;
  personalizationPrice: string;
};

type SizeSelection = {
  label: string;
  enabled: boolean;
  stockQty: string;
};

const DEFAULT_SIZE_OPTIONS = ["Unico", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const UNIQUE_SIZE_KEY = "unico";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function normalizeSizeKey(label: string) {
  return label.trim().toLowerCase();
}

function buildSizeSelections(variants?: VariantItem[]) {
  const selections = DEFAULT_SIZE_OPTIONS.map((label) => ({
    label,
    enabled: false,
    stockQty: "",
  }));
  const byKey = new Map(selections.map((entry) => [normalizeSizeKey(entry.label), entry]));

  if (variants) {
    variants.forEach((variant) => {
      const key = normalizeSizeKey(variant.label);
      const stockValue =
        variant.stockQty !== null && variant.stockQty !== undefined ? String(variant.stockQty) : "";
      const existing = byKey.get(key);
      if (existing) {
        existing.enabled = true;
        existing.stockQty = stockValue;
        return;
      }
      selections.push({ label: variant.label, enabled: true, stockQty: stockValue });
      byKey.set(key, selections[selections.length - 1]);
    });
  }

  return selections;
}

function getEnabledSizes(selections: SizeSelection[]) {
  return selections.filter((entry) => entry.enabled);
}

function createEmptyForm(): ProductFormState {
  return {
    name: "",
    price: "",
    categoryId: "",
    productType: "physical",
    shortDescription: "",
    description: "",
    sku: "",
    compareAtPrice: "",
    stockTracked: false,
    stockQty: "",
    publish: true,
    sizeSelections: buildSizeSelections(),
    personalizationEnabled: false,
    personalizationLabel: "",
    personalizationPrice: "",
  };
}

function formatMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}

function formatPriceForInput(cents?: number | null) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

function parsePriceInput(value: string) {
  const normalized = value.replace(/[^0-9.,]/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function normalizePriceInput(value: string) {
  if (!value.trim()) return "";
  const cents = parsePriceInput(value);
  if (cents === null) return value;
  return (cents / 100).toFixed(2);
}

function parseStockInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

async function assertOk(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || fallback);
  }
  return json;
}

export default function StoreProductsPanel({
  endpointBase,
  categoriesEndpoint,
  storeLocked,
  storeEnabled,
}: StoreProductsPanelProps) {
  const draftKey = useMemo(() => `orya_store_product_draft_${endpointBase}`, [endpointBase]);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductFormState>(createEmptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [categoryMode, setCategoryMode] = useState<"select" | "create">("select");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [digitalFile, setDigitalFile] = useState<File | null>(null);
  const [personalizationOptionId, setPersonalizationOptionId] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const canEdit = storeEnabled && !storeLocked;

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const closeCropper = () => {
    setCropOpen(false);
    setCropFile(null);
  };

  const handleImageSelect = (file: File | null) => {
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(endpointBase, { cache: "no-store" }),
        fetch(categoriesEndpoint, { cache: "no-store" }),
      ]);
      const productsJson = await productsRes.json().catch(() => null);
      const categoriesJson = await categoriesRes.json().catch(() => null);
      if (!productsRes.ok || !productsJson?.ok) {
        throw new Error(productsJson?.error || "Erro ao carregar produtos.");
      }
      if (categoriesRes.ok && categoriesJson?.ok) {
        setCategories(Array.isArray(categoriesJson.items) ? categoriesJson.items : []);
      }
      setItems(Array.isArray(productsJson.items) ? productsJson.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [endpointBase, categoriesEndpoint]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.name, item.slug, categoryMap.get(item.categoryId ?? -1) ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [items, searchTerm, categoryMap]);

  const confirmDeleteItem = useMemo(
    () => items.find((item) => item.id === confirmDeleteId) ?? null,
    [items, confirmDeleteId],
  );

  const mapItemToForm = (item: ProductItem): ProductFormState => ({
    name: item.name,
    price: formatPriceForInput(item.priceCents),
    categoryId: item.categoryId ? String(item.categoryId) : "",
    productType: item.requiresShipping ? "physical" : "digital",
    shortDescription: item.shortDescription ?? "",
    description: item.description ?? "",
    sku: item.sku ?? "",
    compareAtPrice: formatPriceForInput(item.compareAtPriceCents),
    stockTracked: item.stockPolicy === "TRACKED",
    stockQty: item.stockQty !== null && item.stockQty !== undefined ? String(item.stockQty) : "",
    publish: item.isVisible,
    sizeSelections: buildSizeSelections(),
    personalizationEnabled: false,
    personalizationLabel: "",
    personalizationPrice: "",
  });

  const resetModalState = () => {
    setModalError(null);
    setEditingId(null);
    setCategoryMode(categories.length === 0 ? "create" : "select");
    setNewCategoryName("");
    setImageFile(null);
    setDigitalFile(null);
    setPersonalizationOptionId(null);
  };

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      return;
    }
  };

  const loadDraft = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        form?: ProductFormState;
        categoryMode?: "select" | "create";
        newCategoryName?: string;
      };
      return parsed ?? null;
    } catch {
      return null;
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    resetModalState();
    const draft = loadDraft();
    if (draft?.form) {
      setForm({ ...createEmptyForm(), ...draft.form });
      setCategoryMode(draft.categoryMode ?? (categories.length === 0 ? "create" : "select"));
      setNewCategoryName(draft.newCategoryName ?? "");
    } else {
      setForm(createEmptyForm());
      setCategoryMode(categories.length === 0 ? "create" : "select");
      setNewCategoryName("");
    }
    setModalOpen(true);
  };

  const loadProductExtras = async (productId: number) => {
    try {
      const [variantsRes, optionsRes] = await Promise.all([
        fetch(`${endpointBase}/${productId}/variants`, { cache: "no-store" }),
        fetch(`${endpointBase}/${productId}/options`, { cache: "no-store" }),
      ]);
      const variantsJson = await variantsRes.json().catch(() => null);
      const optionsJson = await optionsRes.json().catch(() => null);
      const variants = variantsRes.ok && variantsJson?.ok && Array.isArray(variantsJson.items)
        ? (variantsJson.items as VariantItem[])
        : [];
      const options = optionsRes.ok && optionsJson?.ok && Array.isArray(optionsJson.items)
        ? (optionsJson.items as OptionItem[])
        : [];
      const textOption = options.find((option) => option.optionType === "TEXT") ?? null;

      setForm((prev) => ({
        ...prev,
        sizeSelections: buildSizeSelections(variants),
        personalizationEnabled: Boolean(textOption),
        personalizationLabel: textOption?.label ?? "",
        personalizationPrice: textOption ? formatPriceForInput(textOption.priceDeltaCents) : "",
      }));
      setPersonalizationOptionId(textOption?.id ?? null);
    } catch (err) {
      console.error("loadProductExtras error", err);
    }
  };

  const openEditModal = (item: ProductItem) => {
    setModalMode("edit");
    setForm(mapItemToForm(item));
    resetModalState();
    setCategoryMode("select");
    setEditingId(item.id);
    setModalOpen(true);
    void loadProductExtras(item.id);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalError(null);
    setEditingId(null);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!modalOpen || modalMode !== "create") return;
    const payload = {
      form,
      categoryMode,
      newCategoryName,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      return;
    }
  }, [form, categoryMode, newCategoryName, modalOpen, modalMode, draftKey]);

  const handleToggleSize = (label: string) => {
    setForm((prev) => {
      const key = normalizeSizeKey(label);
      const isUnique = key === UNIQUE_SIZE_KEY;
      const current = prev.sizeSelections;
      const currentEntry = current.find((entry) => normalizeSizeKey(entry.label) === key);
      const nextEnabled = !(currentEntry?.enabled ?? false);
      return {
        ...prev,
        sizeSelections: current.map((entry) => {
          const entryKey = normalizeSizeKey(entry.label);
          if (isUnique) {
            return { ...entry, enabled: entryKey === UNIQUE_SIZE_KEY ? nextEnabled : false };
          }
          if (entryKey === key) {
            return { ...entry, enabled: nextEnabled };
          }
          if (nextEnabled && entryKey === UNIQUE_SIZE_KEY) {
            return { ...entry, enabled: false };
          }
          return entry;
        }),
      };
    });
  };

  const handleSizeStockChange = (label: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      sizeSelections: prev.sizeSelections.map((entry) =>
        normalizeSizeKey(entry.label) === normalizeSizeKey(label)
          ? { ...entry, stockQty: value }
          : entry,
      ),
    }));
  };

  const resolveCategoryId = async () => {
    if (categoryMode === "select") {
      return { ok: true as const, id: form.categoryId ? Number(form.categoryId) : null };
    }
    const name = newCategoryName.trim();
    if (!name) {
      return { ok: false as const, error: "Nome da categoria obrigatorio." };
    }
    const res = await fetch(categoriesEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false as const, error: json?.error || "Erro ao criar categoria." };
    }
    const created = json.item as CategoryOption;
    setCategories((prev) => [created, ...prev]);
    setForm((prev) => ({ ...prev, categoryId: String(created.id) }));
    return { ok: true as const, id: created.id };
  };

  const buildPayload = (categoryId: number | null) => {
    const name = form.name.trim();
    if (!name) {
      return { ok: false as const, error: "Nome obrigatorio." };
    }
    const priceCents = parsePriceInput(form.price);
    if (priceCents === null) {
      return { ok: false as const, error: "Preco invalido." };
    }
    const compareInput = form.compareAtPrice.trim();
    const compareAtPriceCents = compareInput ? parsePriceInput(compareInput) : null;
    if (compareInput && compareAtPriceCents === null) {
      return { ok: false as const, error: "Preco comparado invalido." };
    }
    const enabledSizes = getEnabledSizes(form.sizeSelections);
    let stockQty: number | null = null;
    if (form.stockTracked) {
      if (enabledSizes.length > 0) {
        let total = 0;
        for (const size of enabledSizes) {
          const parsed = parseStockInput(size.stockQty);
          if (parsed === null) {
            return { ok: false as const, error: `Stock invalido para ${size.label}.` };
          }
          total += parsed;
        }
        stockQty = total;
      } else {
        stockQty = parseStockInput(form.stockQty);
        if (stockQty === null) {
          return { ok: false as const, error: "Stock invalido." };
        }
      }
    }

    return {
      ok: true as const,
      payload: {
        name,
        categoryId,
        shortDescription: form.shortDescription.trim() || null,
        description: form.description.trim() || null,
        priceCents,
        compareAtPriceCents,
        sku: form.sku.trim() || null,
        requiresShipping: form.productType === "physical",
        stockPolicy: form.stockTracked ? "TRACKED" : "NONE",
        stockQty,
        status: form.publish ? "ACTIVE" : "DRAFT",
        isVisible: form.publish,
      },
    };
  };

  const validateExtras = () => {
    if (categoryMode === "create" && !newCategoryName.trim()) {
      return "Nome da categoria obrigatorio.";
    }
    if (modalMode === "create" && !imageFile) {
      return "Imagem obrigatoria.";
    }
    if (form.personalizationEnabled && !form.personalizationLabel.trim()) {
      return "Label de personalizacao obrigatoria.";
    }
    if (form.personalizationEnabled && form.personalizationPrice.trim()) {
      if (parsePriceInput(form.personalizationPrice) === null) {
        return "Preco da personalizacao invalido.";
      }
    }
    if (form.stockTracked) {
      const enabledSizes = getEnabledSizes(form.sizeSelections);
      if (enabledSizes.length > 0) {
        for (const size of enabledSizes) {
          if (parseStockInput(size.stockQty) === null) {
            return `Stock invalido para ${size.label}.`;
          }
        }
      } else if (parseStockInput(form.stockQty) === null) {
        return "Stock invalido.";
      }
    }
    if (form.compareAtPrice.trim() && parsePriceInput(form.compareAtPrice) === null) {
      return "Preco comparado invalido.";
    }
    return null;
  };

  const uploadProductImage = async (productId: number) => {
    if (!imageFile) return;
    const formData = new FormData();
    formData.append("file", imageFile);
    const uploadRes = await fetch("/api/upload?scope=store-product", {
      method: "POST",
      body: formData,
    });
    const uploadJson = await uploadRes.json().catch(() => null);
    if (!uploadRes.ok || !uploadJson?.url) {
      throw new Error(uploadJson?.error || "Erro ao fazer upload da imagem.");
    }
    const imageRes = await fetch(`${endpointBase}/${productId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: uploadJson.url,
        altText: form.name.trim() || null,
        isPrimary: true,
      }),
    });
    await assertOk(imageRes, "Erro ao associar imagem.");
  };

  const syncVariants = async (productId: number, priceCents: number) => {
    const enabledSizes = getEnabledSizes(form.sizeSelections);
    const desired = enabledSizes.map((entry) => entry.label);
    const res = await fetch(`${endpointBase}/${productId}/variants`, { cache: "no-store" });
    const json = await assertOk(res, "Erro ao carregar variantes.");
    const existing = Array.isArray(json.items) ? (json.items as VariantItem[]) : [];
    if (desired.length === 0) {
      await Promise.all(
        existing.map(async (variant) => {
          const delRes = await fetch(`${endpointBase}/${productId}/variants/${variant.id}`, { method: "DELETE" });
          await assertOk(delRes, "Erro ao remover variantes.");
        }),
      );
      return;
    }

    const stockByKey = new Map(
      enabledSizes.map((size) => [normalizeSizeKey(size.label), parseStockInput(size.stockQty)]),
    );
    const existingByKey = new Map(existing.map((variant) => [normalizeSizeKey(variant.label), variant]));
    const desiredKeys = new Set(desired.map((label) => normalizeSizeKey(label)));

    await Promise.all(
      desired.map(async (label, index) => {
        const key = normalizeSizeKey(label);
        const stockQty = form.stockTracked ? stockByKey.get(key) ?? null : null;
        const match = existingByKey.get(key);
        if (match) {
          const patchRes = await fetch(`${endpointBase}/${productId}/variants/${match.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label,
              priceCents,
              stockQty,
              sortOrder: index,
              isActive: true,
            }),
          });
          await assertOk(patchRes, "Erro ao atualizar variantes.");
          return;
        }
        const createRes = await fetch(`${endpointBase}/${productId}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            priceCents,
            stockQty,
            sortOrder: index,
            isActive: true,
          }),
        });
        await assertOk(createRes, "Erro ao criar variantes.");
      }),
    );

    await Promise.all(
      existing
        .filter((variant) => !desiredKeys.has(normalizeSizeKey(variant.label)))
        .map(async (variant) => {
          const delRes = await fetch(`${endpointBase}/${productId}/variants/${variant.id}`, { method: "DELETE" });
          await assertOk(delRes, "Erro ao remover variantes.");
        }),
    );
  };

  const syncPersonalization = async (productId: number) => {
    if (!form.personalizationEnabled) {
      if (personalizationOptionId) {
        const delRes = await fetch(`${endpointBase}/${productId}/options/${personalizationOptionId}`, {
          method: "DELETE",
        });
        await assertOk(delRes, "Erro ao remover personalizacao.");
      }
      return;
    }

    const label = form.personalizationLabel.trim();
    if (!label) {
      throw new Error("Label de personalizacao obrigatoria.");
    }
    const priceDeltaCents = form.personalizationPrice.trim()
      ? parsePriceInput(form.personalizationPrice)
      : 0;
    if (priceDeltaCents === null) {
      throw new Error("Preco da personalizacao invalido.");
    }

    if (personalizationOptionId) {
      const patchRes = await fetch(`${endpointBase}/${productId}/options/${personalizationOptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionType: "TEXT",
          label,
          required: false,
          priceDeltaCents,
        }),
      });
      await assertOk(patchRes, "Erro ao atualizar personalizacao.");
      return;
    }

    const createRes = await fetch(`${endpointBase}/${productId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        optionType: "TEXT",
        label,
        required: false,
        priceDeltaCents,
        sortOrder: 0,
      }),
    });
    await assertOk(createRes, "Erro ao criar personalizacao.");
  };

  const uploadDigitalAsset = async (productId: number) => {
    if (!digitalFile) return;
    const formData = new FormData();
    formData.append("file", digitalFile);
    const res = await fetch(`${endpointBase}/${productId}/digital-assets`, {
      method: "POST",
      body: formData,
    });
    await assertOk(res, "Erro ao carregar ficheiro digital.");
  };

  const handleCreate = async () => {
    if (!canEdit) return;
    const categoryResult = await resolveCategoryId();
    if (!categoryResult.ok) {
      setModalError(categoryResult.error);
      return;
    }
    const result = buildPayload(categoryResult.id);
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    const extrasError = validateExtras();
    if (extrasError) {
      setModalError(extrasError);
      return;
    }

    setSavingId(-1);
    setModalError(null);
    let created: ProductItem | null = null;
    try {
      const res = await fetch(endpointBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar produto.");
      }
      const createdItem = json.item as ProductItem;
      created = createdItem;
      setItems((prev) => [createdItem, ...prev]);

      await uploadProductImage(created.id);
      await syncVariants(created.id, result.payload.priceCents);
      await syncPersonalization(created.id);
      if (form.productType === "digital") {
        await uploadDigitalAsset(created.id);
      }

      closeModal();
      clearDraft();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado.";
      if (created) {
        setModalMode("edit");
        setEditingId(created.id);
        setCategoryMode("select");
        setNewCategoryName("");
        void loadProductExtras(created.id);
        setModalError(`Produto criado, mas falta completar detalhes: ${message}`);
      } else {
        setModalError(message);
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!canEdit) return;
    const categoryResult = await resolveCategoryId();
    if (!categoryResult.ok) {
      setModalError(categoryResult.error);
      return;
    }
    const result = buildPayload(categoryResult.id);
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    const extrasError = validateExtras();
    if (extrasError) {
      setModalError(extrasError);
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
        throw new Error(json?.error || "Erro ao atualizar produto.");
      }
      const updated = json.item as ProductItem;
      setItems((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));

      await uploadProductImage(updated.id);
      await syncVariants(updated.id, result.payload.priceCents);
      await syncPersonalization(updated.id);
      if (form.productType === "digital") {
        await uploadDigitalAsset(updated.id);
      }

      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleVisibility = async (item: ProductItem) => {
    if (!canEdit) return;
    setSavingId(item.id);
    setError(null);
    const nextVisible = !item.isVisible;
    const nextStatus = nextVisible && item.status === "DRAFT" ? "ACTIVE" : item.status;
    try {
      const res = await fetch(`${endpointBase}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: nextVisible, status: nextStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar visibilidade.");
      }
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? json.item : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
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
        throw new Error(json?.error || "Erro ao remover produto.");
      }
      setItems((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingId(null);
    }
  };

  const renderFieldMeta = (label: string, tone: "required" | "optional") => (
    <span
      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] ${
        tone === "required"
          ? "border-emerald-400/40 text-emerald-200"
          : "border-white/15 text-white/40"
      }`}
    >
      {label}
    </span>
  );

  const requiredMark = <span className="ml-1 text-emerald-300">*</span>;

  const nameValid = form.name.trim().length > 0;
  const priceValid = parsePriceInput(form.price) !== null;
  const compareValid = !form.compareAtPrice.trim() || parsePriceInput(form.compareAtPrice) !== null;
  const categoryValid = categoryMode === "select" || newCategoryName.trim().length > 0;
  const imageValid = modalMode !== "create" || Boolean(imageFile);
  const personalizationValid = !form.personalizationEnabled || form.personalizationLabel.trim().length > 0;
  const personalizationPriceValid =
    !form.personalizationEnabled ||
    !form.personalizationPrice.trim() ||
    parsePriceInput(form.personalizationPrice) !== null;
  const enabledSizes = getEnabledSizes(form.sizeSelections);
  const sizeStockValid =
    !form.stockTracked ||
    enabledSizes.length === 0 ||
    enabledSizes.every((size) => parseStockInput(size.stockQty) !== null);
  const stockValid =
    !form.stockTracked || (enabledSizes.length > 0 ? sizeStockValid : parseStockInput(form.stockQty) !== null);
  const canSubmit =
    nameValid &&
    priceValid &&
    compareValid &&
    categoryValid &&
    imageValid &&
    personalizationValid &&
    personalizationPriceValid &&
    stockValid;

  const modal = (
    <StorePanelModal
      open={modalOpen}
      onClose={closeModal}
      eyebrow={modalMode === "create" ? "Novo produto" : "Editar produto"}
      title={modalMode === "create" ? "Produto" : form.name || "Produto"}
      description="Tudo o que precisas para publicar rapidamente."
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {modalMode === "create" ? (
            <button
              type="button"
              onClick={() => {
                setForm(createEmptyForm());
                setCategoryMode(categories.length === 0 ? "create" : "select");
                setNewCategoryName("");
                setImageFile(null);
                setDigitalFile(null);
                setPersonalizationOptionId(null);
                clearDraft();
              }}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 hover:border-white/30"
            >
              Apagar tudo
            </button>
          ) : null}
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
                ? "Criar produto"
                : "Guardar alteracoes"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
          Campos obrigatorios marcados com *
        </p>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
          <span>Base do produto</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>
                Nome {requiredMark}
              </span>
              {renderFieldMeta("Obrig.", "required")}
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Nome do produto"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>
                Preco (EUR) {requiredMark}
              </span>
              {renderFieldMeta("Obrig.", "required")}
            </span>
            <input
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              onBlur={(e) => setForm((prev) => ({ ...prev, price: normalizePriceInput(e.target.value) }))}
              inputMode="decimal"
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="49.90"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>Categoria</span>
              {renderFieldMeta("Opc.", "optional")}
            </span>
            <select
              value={categoryMode === "select" ? form.categoryId : "__new__"}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setCategoryMode("create");
                  setForm((prev) => ({ ...prev, categoryId: "" }));
                } else {
                  setCategoryMode("select");
                  setForm((prev) => ({ ...prev, categoryId: e.target.value }));
                }
              }}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            >
              <option value="">Sem categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
              <option value="__new__">Criar nova categoria</option>
            </select>
          </label>
          {categoryMode === "create" ? (
            <label className="flex flex-col gap-1 text-xs text-white/70">
              <span className="flex items-center justify-between text-xs font-medium text-white/70">
                <span>
                  Nova categoria {requiredMark}
                </span>
                {renderFieldMeta("Obrig.", "required")}
              </span>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Ex: Merch"
              />
            </label>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>
                Tipo de produto {requiredMark}
              </span>
              {renderFieldMeta("Obrig.", "required")}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, productType: "physical" }))}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  form.productType === "physical"
                    ? "border-white/40 bg-white/15 text-white"
                    : "border-white/15 text-white/70 hover:border-white/40"
                }`}
                aria-pressed={form.productType === "physical"}
              >
                Fisico (envio)
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, productType: "digital" }))}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  form.productType === "digital"
                    ? "border-white/40 bg-white/15 text-white"
                    : "border-white/15 text-white/70 hover:border-white/40"
                }`}
                aria-pressed={form.productType === "digital"}
              >
                Digital (download)
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>
                Imagem principal {modalMode === "create" ? requiredMark : null}
              </span>
              {renderFieldMeta(modalMode === "create" ? "Obrig." : "Opc.", modalMode === "create" ? "required" : "optional")}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                handleImageSelect(file);
                if (imageInputRef.current) imageInputRef.current.value = "";
              }}
              ref={imageInputRef}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/20 file:px-3 file:py-1 file:text-xs file:text-white"
            />
            <p className="text-[11px] text-white/50">PNG/JPG/WebP ate 5MB.</p>
            <p className="text-[11px] text-white/50">A imagem e recortada a 1:1 antes do upload.</p>
            {imagePreviewUrl ? (
              <img src={imagePreviewUrl} alt="Preview" className="h-24 w-24 rounded-xl object-cover" />
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
          <span>Descricao</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <label className="flex flex-col gap-1 text-xs text-white/70">
          <span className="flex items-center justify-between text-xs font-medium text-white/70">
            <span>Resumo curto</span>
            {renderFieldMeta("Opc.", "optional")}
          </span>
          <textarea
            value={form.shortDescription}
            onChange={(e) => setForm((prev) => ({ ...prev, shortDescription: e.target.value }))}
            className="min-h-[70px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Frase rapida para descrever o produto."
          />
          <p className="text-[11px] text-white/45">Aparece na listagem e nos cards da loja.</p>
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/70">
          <span className="flex items-center justify-between text-xs font-medium text-white/70">
            <span>Descricao</span>
            {renderFieldMeta("Opc.", "optional")}
          </span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-[110px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Detalhes completos, materiais, instrucoes, etc."
          />
          <p className="text-[11px] text-white/45">Aparece na pagina do produto.</p>
        </label>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
          <span>Variantes e personalizacao</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">Tamanhos</p>
                <p className="text-xs text-white/60">Seleciona os tamanhos disponiveis.</p>
              </div>
              {renderFieldMeta("Opc.", "optional")}
            </div>
            <div className="flex flex-wrap gap-2">
              {form.sizeSelections.map((size) => {
                const isUnique = normalizeSizeKey(size.label) === UNIQUE_SIZE_KEY;
                return (
                  <button
                    key={size.label}
                    type="button"
                    onClick={() => handleToggleSize(size.label)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      size.enabled
                        ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-100"
                        : "border-white/15 text-white/70 hover:border-white/40"
                    }`}
                    aria-pressed={size.enabled}
                    title={isUnique ? "Tamanho unico" : undefined}
                  >
                    {size.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-white/50">
              {enabledSizes.length > 0 ? `${enabledSizes.length} tamanhos selecionados.` : "Sem tamanhos definidos."}
            </p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between text-xs text-white/70">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.personalizationEnabled}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      personalizationEnabled: e.target.checked,
                    }))
                  }
                  className="accent-[#6BFFFF]"
                />
                <span>Permitir personalizacao</span>
              </label>
              {renderFieldMeta("Opc.", "optional")}
            </div>
            {form.personalizationEnabled ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-white/70">
                  <span className="flex items-center justify-between text-xs font-medium text-white/70">
                    <span>
                      Label de personalizacao {requiredMark}
                    </span>
                    {renderFieldMeta("Obrig.", "required")}
                  </span>
                  <input
                    value={form.personalizationLabel}
                    onChange={(e) => setForm((prev) => ({ ...prev, personalizationLabel: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="Ex: Nome a estampar"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-white/70">
                  <span className="flex items-center justify-between text-xs font-medium text-white/70">
                    <span>Preco da personalizacao (EUR)</span>
                    {renderFieldMeta("Opc.", "optional")}
                  </span>
                  <input
                    value={form.personalizationPrice}
                    onChange={(e) => setForm((prev) => ({ ...prev, personalizationPrice: e.target.value }))}
                    onBlur={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        personalizationPrice: normalizePriceInput(e.target.value),
                      }))
                    }
                    inputMode="decimal"
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="0.00"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
          <span>Gestao e publicacao</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>SKU</span>
              {renderFieldMeta("Opc.", "optional")}
            </span>
            <input
              value={form.sku}
              onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="SKU-001"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>Preco comparado</span>
              {renderFieldMeta("Opc.", "optional")}
            </span>
            <input
              value={form.compareAtPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, compareAtPrice: e.target.value }))}
              onBlur={(e) => setForm((prev) => ({ ...prev, compareAtPrice: normalizePriceInput(e.target.value) }))}
              inputMode="decimal"
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="59.90"
            />
          </label>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Stock</p>
              <p className="text-xs text-white/60">Ativa apenas se precisares de controlar unidades.</p>
            </div>
            {renderFieldMeta("Opc.", "optional")}
            <label className="inline-flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={form.stockTracked}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    stockTracked: e.target.checked,
                    stockQty: e.target.checked ? prev.stockQty : "",
                  }))
                }
                className="accent-[#6BFFFF]"
              />
              Gerir stock
            </label>
          </div>
          {form.stockTracked && enabledSizes.length > 0 ? (
            <div className="grid gap-2">
              {enabledSizes.map((size) => (
                <label key={size.label} className="flex flex-col gap-1 text-xs text-white/70">
                  <span className="flex items-center justify-between text-xs font-medium text-white/70">
                    <span>
                      Stock {size.label} {requiredMark}
                    </span>
                    {renderFieldMeta("Obrig.", "required")}
                  </span>
                  <input
                    value={size.stockQty}
                    onChange={(e) => handleSizeStockChange(size.label, e.target.value)}
                    inputMode="numeric"
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="0"
                  />
                </label>
              ))}
              <p className="text-[11px] text-white/45">O total em stock e calculado pela soma dos tamanhos.</p>
            </div>
          ) : form.stockTracked ? (
            <label className="flex flex-col gap-1 text-xs text-white/70">
              <span className="flex items-center justify-between text-xs font-medium text-white/70">
                <span>
                  Quantidade em stock {requiredMark}
                </span>
                {renderFieldMeta("Obrig.", "required")}
              </span>
              <input
                value={form.stockQty}
                onChange={(e) => setForm((prev) => ({ ...prev, stockQty: e.target.value }))}
                inputMode="numeric"
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="0"
              />
            </label>
          ) : enabledSizes.length > 0 ? (
            <p className="text-[11px] text-white/50">Ativa gerir stock para definir unidades por tamanho.</p>
          ) : null}
        </div>

        {form.productType === "digital" ? (
          <div className="grid gap-2 text-xs text-white/70">
            <span className="flex items-center justify-between text-xs font-medium text-white/70">
              <span>Ficheiro digital</span>
              {renderFieldMeta("Opc.", "optional")}
            </span>
            <input
              type="file"
              onChange={(e) => setDigitalFile(e.target.files?.[0] ?? null)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/20 file:px-3 file:py-1 file:text-xs file:text-white"
            />
            <p className="text-[11px] text-white/50">
              Se preferires, podes enviar manualmente o ficheiro ao cliente depois da compra.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Publicacao</p>
              <p className="text-xs text-white/60">Mostra o produto logo na loja.</p>
            </div>
            {renderFieldMeta("Opc.", "optional")}
            <label className="inline-flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={form.publish}
                onChange={(e) => setForm((prev) => ({ ...prev, publish: e.target.checked }))}
                className="accent-[#6BFFFF]"
              />
              Publicar agora
            </label>
          </div>
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
          <h2 className="text-lg font-semibold text-white">Produtos</h2>
          <p className="text-sm text-white/65">Cria e publica produtos com imagem e tamanhos num unico passo.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || savingId !== null}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          Novo produto
        </button>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {storeLocked && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Catalogo bloqueado. Desbloqueia antes de editar produtos.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-xs rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white outline-none focus:border-white/40"
          placeholder="Pesquisar produto"
        />
        <span className="text-xs text-white/60">
          {searchTerm
            ? `${filteredItems.length} de ${items.length} produtos`
            : `${items.length} produtos`}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar produtos...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          {items.length === 0 ? "Sem produtos por agora." : "Sem resultados para a pesquisa."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Preco</th>
                <th className="px-4 py-3 text-left">Stock</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Visivel</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const statusLabel =
                  item.status === "ACTIVE" ? "Ativo" : item.status === "ARCHIVED" ? "Arquivado" : "Rascunho";
                const statusTone =
                  item.status === "ACTIVE"
                    ? "bg-emerald-500/20 text-emerald-100"
                    : item.status === "ARCHIVED"
                      ? "bg-rose-500/20 text-rose-100"
                      : "bg-white/10 text-white/70";
                const stockLabel =
                  item.stockPolicy === "TRACKED"
                    ? item.stockQty !== null && item.stockQty !== undefined
                      ? String(item.stockQty)
                      : "0"
                    : "Ilimitado";

                return (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{item.name}</div>
                      <div className="text-[11px] text-white/45">{item.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {item.requiresShipping ? "Fisico" : "Digital"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {item.categoryId ? categoryMap.get(item.categoryId) ?? "-" : "Sem categoria"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/80">
                      {formatMoney(item.priceCents, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">{stockLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[11px] ${statusTone}`}>{statusLabel}</span>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs text-white/70">
                        <input
                          type="checkbox"
                          checked={item.isVisible}
                          onChange={() => handleToggleVisibility(item)}
                          disabled={!canEdit || savingId !== null}
                          className="accent-[#6BFFFF]"
                        />
                        {item.isVisible ? "Sim" : "Nao"}
                      </label>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal}

      <StoreImageCropperModal
        open={cropOpen}
        file={cropFile}
        title="Recortar imagem"
        description="Formato 1:1. Ajusta antes de guardar."
        onClose={closeCropper}
        onConfirm={(cropped) => {
          closeCropper();
          setImageFile(cropped);
        }}
      />

      <ConfirmDestructiveActionDialog
        open={Boolean(confirmDeleteItem)}
        title={confirmDeleteItem ? `Remover ${confirmDeleteItem.name}?` : "Remover produto"}
        description="Esta acao e permanente."
        consequences={["O produto deixa de aparecer na loja.", "Os dados de vendas permanecem intactos."]}
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
