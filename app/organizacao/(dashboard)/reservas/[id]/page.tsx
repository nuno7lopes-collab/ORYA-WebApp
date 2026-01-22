"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { getEventCoverUrl } from "@/lib/eventCover";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  CTA_DANGER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DURATION_OPTIONS = [30, 60, 90, 120];

type Service = {
  id: number;
  policyId?: number | null;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode?: "FIXED" | "CHOOSE_AT_BOOKING" | null;
  defaultLocationText?: string | null;
  policy?: {
    id: number;
    name: string;
    policyType: string;
    cancellationWindowMinutes: number | null;
  } | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
};

type ServicePack = {
  id: number;
  quantity: number;
  packPriceCents: number;
  label: string | null;
  recommended: boolean;
  isActive: boolean;
};

type PolicyItem = {
  id: number;
  name: string;
  policyType: string;
  cancellationWindowMinutes: number | null;
};

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
};

type ResourceItem = {
  id: number;
  label: string;
  capacity: number;
  isActive: boolean;
};

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}


export default function ServicoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const idRaw = params?.id;
  const serviceId = useMemo(() => {
    const value = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [idRaw]);

  const serviceKey = serviceId ? `/api/organizacao/servicos/${serviceId}` : null;
  const packsEnabled = false;
  const packsKey = packsEnabled && serviceId ? `/api/organizacao/servicos/${serviceId}/packs` : null;

  const { data: serviceData, mutate: mutateService } = useSWR<{ ok: boolean; service: Service }>(
    serviceKey,
    fetcher,
  );
  const { data: policiesData } = useSWR<{ ok: boolean; items: PolicyItem[] }>(
    "/api/organizacao/policies",
    fetcher,
  );
  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    "/api/organizacao/reservas/profissionais",
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    "/api/organizacao/reservas/recursos",
    fetcher,
  );
  const { data: packsData, mutate: mutatePacks } = useSWR<{ ok: boolean; items: ServicePack[] }>(
    packsKey,
    fetcher,
  );

  const service = serviceData?.service ?? null;
  const packs = packsEnabled ? packsData?.items ?? [] : [];
  const policies = policiesData?.items ?? [];
  const professionals = professionalsData?.items ?? [];
  const resources = resourcesData?.items ?? [];
  const activeProfessionals = professionals.filter((professional) => professional.isActive);
  const activeResources = resources.filter((resource) => resource.isActive);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState("60");
  const [formUnitPrice, setFormUnitPrice] = useState("0");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formCategoryTag, setFormCategoryTag] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formLocationMode, setFormLocationMode] = useState<LocationMode>("FIXED");
  const [formLocationText, setFormLocationText] = useState("");
  const [formPolicyId, setFormPolicyId] = useState("");
  const [linkedProfessionalIds, setLinkedProfessionalIds] = useState<number[]>([]);
  const [linkedResourceIds, setLinkedResourceIds] = useState<number[]>([]);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [packQuantity, setPackQuantity] = useState("5");
  const [packPrice, setPackPrice] = useState("90");
  const [packLabel, setPackLabel] = useState("");
  const [packRecommended, setPackRecommended] = useState(true);
  const [packSaving, setPackSaving] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [packDrafts, setPackDrafts] = useState<Record<number, { quantity: string; price: string; label: string; recommended: boolean; isActive: boolean }>>({});
  const [packSavingId, setPackSavingId] = useState<number | null>(null);

  useEffect(() => {
    if (!service) return;
    setFormTitle(service.title ?? "");
    setFormDescription(service.description ?? "");
    setFormDuration(String(service.durationMinutes ?? 60));
    setFormUnitPrice(((service.unitPriceCents ?? 0) / 100).toFixed(2));
    setFormCurrency(service.currency ?? "EUR");
    setFormCategoryTag(service.categoryTag ?? "");
    setCoverUrl(service.coverImageUrl ?? null);
    setFormLocationMode(service.locationMode ?? "FIXED");
    setFormLocationText(service.defaultLocationText ?? "");
    setFormPolicyId(service.policyId ? String(service.policyId) : "");
    setLinkedProfessionalIds(service.professionalLinks?.map((link) => link.professionalId) ?? []);
    setLinkedResourceIds(service.resourceLinks?.map((link) => link.resourceId) ?? []);
  }, [service]);

  useEffect(() => {
    if (!packsEnabled || !packsData?.items) return;
    const draftMap: Record<number, { quantity: string; price: string; label: string; recommended: boolean; isActive: boolean }> = {};
    packsData.items.forEach((pack) => {
      draftMap[pack.id] = {
        quantity: String(pack.quantity),
        price: (pack.packPriceCents / 100).toFixed(2),
        label: pack.label ?? "",
        recommended: pack.recommended,
        isActive: pack.isActive,
      };
    });
    setPackDrafts(draftMap);
  }, [packsData?.items]);

  const toggleService = async () => {
    if (!serviceId || !service) return;
    setServiceError(null);
    const res = await fetch(`/api/organizacao/servicos/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setServiceError(json?.error || "Não foi possível atualizar o serviço.");
      return;
    }
    mutateService();
  };

  const toggleProfessionalLink = (id: number) => {
    setLinkedProfessionalIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleResourceLink = (id: number) => {
    setLinkedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const coverPreviewUrl = useMemo(() => {
    if (!coverUrl) return null;
    return getEventCoverUrl(coverUrl, {
      seed: `service-${serviceId ?? "cover"}`,
      width: 600,
      quality: 72,
      square: true,
    });
  }, [coverUrl, serviceId]);

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    setServiceError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=service-cover", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro upload cover", err);
      setServiceError(err instanceof Error ? err.message : "Não foi possível carregar a imagem.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverCropCancel = () => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
  };

  const handleCoverCropConfirm = async (file: File) => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
    await uploadCoverFile(file);
  };

  const handleServiceSave = async () => {
    if (!serviceId) return;
    setServiceSaving(true);
    setServiceError(null);

    try {
      const res = await fetch(`/api/organizacao/servicos/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          durationMinutes: Number(formDuration),
          unitPriceCents: Math.round(Number(formUnitPrice) * 100),
          currency: formCurrency,
          categoryTag: formCategoryTag.trim() || null,
          coverImageUrl: coverUrl,
          locationMode: formLocationMode,
          defaultLocationText: formLocationMode === "FIXED" ? formLocationText.trim() || null : null,
          policyId: formPolicyId ? Number(formPolicyId) : null,
          professionalIds: linkedProfessionalIds,
          resourceIds: linkedResourceIds,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao guardar serviço.");
      }
      mutateService();
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "Erro ao guardar serviço.");
    } finally {
      setServiceSaving(false);
    }
  };

  const handlePackCreate = async () => {
    if (!serviceId) return;
    setPackSaving(true);
    setPackError(null);
    try {
      const res = await fetch(`/api/organizacao/servicos/${serviceId}/packs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Math.round(Number(packQuantity)),
          packPriceCents: Math.round(Number(packPrice) * 100),
          label: packLabel.trim() || null,
          recommended: packRecommended,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar pack.");
      }
      setPackQuantity("5");
      setPackPrice("90");
      setPackLabel("");
      setPackRecommended(true);
      mutatePacks();
    } catch (err) {
      setPackError(err instanceof Error ? err.message : "Erro ao criar pack.");
    } finally {
      setPackSaving(false);
    }
  };

  const handlePackUpdate = async (packId: number) => {
    if (!serviceId) return;
    const draft = packDrafts[packId];
    if (!draft) return;
    setPackSavingId(packId);
    setPackError(null);
    try {
      const res = await fetch(`/api/organizacao/servicos/${serviceId}/packs/${packId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Math.round(Number(draft.quantity)),
          packPriceCents: Math.round(Number(draft.price) * 100),
          label: draft.label.trim() || null,
          recommended: draft.recommended,
          isActive: draft.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar pack.");
      }
      mutatePacks();
    } catch (err) {
      setPackError(err instanceof Error ? err.message : "Erro ao atualizar pack.");
    } finally {
      setPackSavingId(null);
    }
  };

  const handlePackDisable = async (packId: number) => {
    if (!serviceId) return;
    await fetch(`/api/organizacao/servicos/${serviceId}/packs/${packId}`, {
      method: "DELETE",
    });
    mutatePacks();
  };

  if (!serviceId) {
    return <div className="text-white/70">Serviço inválido.</div>;
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>Serviço</p>
        <h1 className="text-2xl font-semibold text-white">{service?.title || "Serviço"}</h1>
        <p className={DASHBOARD_MUTED}>
          {service
            ? `${service.durationMinutes} min · ${formatMoney(service.unitPriceCents, service.currency)}`
            : "A carregar detalhes..."}
        </p>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}> 
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Detalhes</h2>
            <p className={DASHBOARD_MUTED}>Define o serviço e o preço unitário.</p>
          </div>
          {service && (
            <button type="button" className={CTA_SECONDARY} onClick={toggleService}>
              {service.isActive ? "Desativar" : "Ativar"}
            </button>
          )}
        </div>

        <div>
          <label className="text-sm text-white/80">Título</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Descrição</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            rows={3}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Capa do serviço</label>
          <div className="mt-2 flex flex-wrap gap-4">
            <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreviewUrl} alt="Capa do serviço" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-white/50">
                  Sem capa
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                />
                <span>{coverUrl ? "Substituir capa" : "Adicionar capa"}</span>
              </label>
              {coverUrl && (
                <button type="button" className={CTA_SECONDARY} onClick={() => setCoverUrl(null)}>
                  Remover capa
                </button>
              )}
              <p className={DASHBOARD_MUTED}>Imagem quadrada recomendada.</p>
              {uploadingCover && <p className={DASHBOARD_MUTED}>A carregar imagem...</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/80">Duração (min)</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
            >
              {DURATION_OPTIONS.map((value) => (
                <option key={value} value={String(value)}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/80">Preço</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formUnitPrice}
              onChange={(e) => setFormUnitPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Moeda</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/80">Categoria (tag)</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formCategoryTag}
            onChange={(e) => setFormCategoryTag(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/80">Modo de localização</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formLocationMode}
              onChange={(e) => setFormLocationMode(e.target.value as LocationMode)}
            >
              <option value="FIXED">Local fixo</option>
              <option value="CHOOSE_AT_BOOKING">Escolher na marcação</option>
            </select>
          </div>
          {formLocationMode === "FIXED" && (
            <div>
              <label className="text-sm text-white/80">Local por defeito</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={formLocationText}
                onChange={(e) => setFormLocationText(e.target.value)}
                placeholder="Ex: Rua Central, 45 · Sala 2"
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-white/80">Política de cancelamento</label>
          <select
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formPolicyId}
            onChange={(event) => setFormPolicyId(event.target.value)}
          >
            <option value="">Usar política default</option>
            {policies.map((policy) => (
              <option key={policy.id} value={String(policy.id)}>
                {policy.name} · {policy.policyType}
              </option>
            ))}
          </select>
        </div>

        {serviceError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {serviceError}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={CTA_PRIMARY} onClick={handleServiceSave} disabled={serviceSaving}>
            {serviceSaving ? "A guardar..." : "Guardar alterações"}
          </button>
          <button type="button" className={CTA_SECONDARY} onClick={() => router.push("/organizacao/reservas")}>
            Voltar
          </button>
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Equipa e recursos</h2>
          <p className={DASHBOARD_MUTED}>
            Define quem pode executar este serviço. Se não selecionares ninguém, usa todos os ativos.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/80">Profissionais</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedProfessionalIds(activeProfessionals.map((item) => item.id))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedProfessionalIds([])}
                >
                  Limpar
                </button>
              </div>
            </div>
            {activeProfessionals.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem profissionais ativos.</p>
            ) : (
              <div className="space-y-2">
                {activeProfessionals.map((professional) => (
                  <label
                    key={professional.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                  >
                    <span>{professional.name}</span>
                    <input
                      type="checkbox"
                      checked={linkedProfessionalIds.includes(professional.id)}
                      onChange={() => toggleProfessionalLink(professional.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/80">Recursos</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedResourceIds(activeResources.map((item) => item.id))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedResourceIds([])}
                >
                  Limpar
                </button>
              </div>
            </div>
            {activeResources.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem recursos ativos.</p>
            ) : (
              <div className="space-y-2">
                {activeResources.map((resource) => (
                  <label
                    key={resource.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                  >
                    <span>
                      {resource.label} · {resource.capacity}
                    </span>
                    <input
                      type="checkbox"
                      checked={linkedResourceIds.includes(resource.id)}
                      onChange={() => toggleResourceLink(resource.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-3")}>
        <div>
          <h2 className="text-base font-semibold text-white">Agenda central</h2>
          <p className={DASHBOARD_MUTED}>
            A disponibilidade e as marcações são geridas no calendário principal.
          </p>
        </div>
        <button
          type="button"
          className={CTA_SECONDARY}
          onClick={() => router.push("/organizacao/reservas?tab=availability")}
        >
          Abrir agenda
        </button>
      </section>

      {packsEnabled && (
        <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
          <div>
            <h2 className="text-base font-semibold text-white">Packs de créditos</h2>
            <p className={DASHBOARD_MUTED}>Opcional, sempre do mesmo serviço.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-sm text-white/80">Quantidade</label>
              <input
                type="number"
                min="1"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={packQuantity}
                onChange={(e) => setPackQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-white/80">Preço pack</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={packPrice}
                onChange={(e) => setPackPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-white/80">Etiqueta</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={packLabel}
                onChange={(e) => setPackLabel(e.target.value)}
                placeholder="Ex: Mais popular"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={packRecommended}
                  onChange={(e) => setPackRecommended(e.target.checked)}
                />
                Recomendar
              </label>
            </div>
          </div>

          {packError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {packError}
            </div>
          )}

          <button type="button" className={CTA_PRIMARY} onClick={handlePackCreate} disabled={packSaving}>
            {packSaving ? "A criar..." : "Criar pack"}
          </button>

          <div className="space-y-3">
            {packs.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Sem packs criados.
              </div>
            )}
            {packs.map((pack) => {
              const draft = packDrafts[pack.id];
              return (
                <div key={pack.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {draft?.label || pack.label || "Pack"} · {draft?.quantity ?? pack.quantity} unidades
                    </p>
                    <p className="text-[12px] text-white/60">
                      {draft?.price ? `${draft.price} ${service?.currency ?? "EUR"}` : formatMoney(pack.packPriceCents, service?.currency ?? "EUR")}
                      {pack.recommended ? " · Recomendado" : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                    {pack.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {draft && (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="text-[12px] text-white/70">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={draft.quantity}
                        onChange={(e) =>
                          setPackDrafts((prev) => ({
                            ...prev,
                            [pack.id]: { ...draft, quantity: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-white/70">Preço</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={draft.price}
                        onChange={(e) =>
                          setPackDrafts((prev) => ({
                            ...prev,
                            [pack.id]: { ...draft, price: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-white/70">Etiqueta</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={draft.label}
                        onChange={(e) =>
                          setPackDrafts((prev) => ({
                            ...prev,
                            [pack.id]: { ...draft, label: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                      <label className="flex items-center gap-2 text-[12px] text-white/70">
                        <input
                          type="checkbox"
                          checked={draft.recommended}
                          onChange={(e) =>
                            setPackDrafts((prev) => ({
                              ...prev,
                              [pack.id]: { ...draft, recommended: e.target.checked },
                            }))
                          }
                        />
                        Recomendar
                      </label>
                      <label className="flex items-center gap-2 text-[12px] text-white/70">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(e) =>
                            setPackDrafts((prev) => ({
                              ...prev,
                              [pack.id]: { ...draft, isActive: e.target.checked },
                            }))
                          }
                        />
                        Ativo
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={CTA_PRIMARY}
                    onClick={() => handlePackUpdate(pack.id)}
                    disabled={packSavingId === pack.id}
                  >
                    {packSavingId === pack.id ? "A guardar..." : "Guardar"}
                  </button>
                  <button type="button" className={CTA_DANGER} onClick={() => handlePackDisable(pack.id)}>
                    Desativar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}
    </div>
      <EventCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={handleCoverCropConfirm}
      />
    </>
  );
}
