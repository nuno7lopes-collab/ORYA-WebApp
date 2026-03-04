"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref, parseOrganizationId, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { mapPaymentGateUiState, parseApiError } from "@/lib/payments/paymentGateUi";
import { getEventCoverUrl } from "@/lib/eventCover";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_shared/dashboardUi";

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";
type CreationKind = "CLASS";

type ProfessionalItem = {
  id: number;
  name: string;
  isActive: boolean;
};

type ResourceItem = {
  id: number;
  label: string;
  isActive: boolean;
  sourceType?: "RESOURCE" | "COURT";
  resourceId?: number | null;
  courtId?: number | null;
  clubName?: string | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_CURRENCY = "EUR";
const DEFAULT_LOCATION_MODE: LocationMode = "FIXED";
const DURATION_OPTIONS = [30, 60, 90, 120];

function resolveResourceLinkId(resource: ResourceItem): number | null {
  if (typeof resource.resourceId === "number" && Number.isFinite(resource.resourceId) && resource.resourceId > 0) {
    return resource.resourceId;
  }
  if ((resource.sourceType ?? "RESOURCE") === "RESOURCE") {
    return resource.id;
  }
  return null;
}

export default function NovaAulaPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationIdFromQuery = parseOrganizationId(searchParams?.get("organizationId"));
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationId = organizationIdFromQuery ?? organizationIdFromPath;
  const creationKind: CreationKind = "CLASS";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("20");
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCtaHref, setErrorCtaHref] = useState<string | null>(null);
  const [errorCtaLabel, setErrorCtaLabel] = useState<string | null>(null);

  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers"),
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/resources?includeCourts=1"),
    fetcher,
  );

  const activeProfessionals = (professionalsData?.items ?? []).filter((item) => item.isActive);
  const courtOptions = useMemo(
    () =>
      (resourcesData?.items ?? [])
        .filter((resource) => (resource.sourceType ?? "RESOURCE") === "COURT" && resource.isActive)
        .map((resource) => {
          const linkId = resolveResourceLinkId(resource);
          return {
            ...resource,
            linkId,
            labelText: resource.clubName ? `${resource.label} · ${resource.clubName}` : resource.label,
          };
        })
        .filter((resource) => resource.linkId != null),
    [resourcesData?.items],
  );

  const coverPreviewUrl = useMemo(() => {
    if (!coverUrl) return null;
    return getEventCoverUrl(coverUrl, {
      seed: "new-class-cover",
      width: 600,
      quality: 72,
      square: true,
    });
  }, [coverUrl]);

  const entityLabel = "aula";

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    setError(null);
    setErrorCtaHref(null);
    setErrorCtaLabel(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!organizationId) throw new Error("Organização inválida.");

      const res = await fetch(`/api/upload?scope=service-cover&organizationId=${organizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }

      setCoverUrl(json.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a imagem.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
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

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(`Indica o título da ${entityLabel}.`);
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }

    const durationValue = Number(durationMinutes);
    if (!DURATION_OPTIONS.includes(durationValue)) {
      setError("Seleciona a duração.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }

    const unitPriceValue = Number(unitPrice.replace(",", "."));
    if (!Number.isFinite(unitPriceValue) || unitPriceValue < 0) {
      setError("Preço inválido.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }

    const professionalIdValue = selectedProfessionalId ? Number(selectedProfessionalId) : null;
    if (selectedProfessionalId && (!Number.isFinite(professionalIdValue) || (professionalIdValue ?? 0) <= 0)) {
      setError("Treinador inválido.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }

    const resourceIdValue = selectedResourceId ? Number(selectedResourceId) : null;
    if (selectedResourceId && (!Number.isFinite(resourceIdValue) || (resourceIdValue ?? 0) <= 0)) {
      setError("Campo inválido.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }

    setSaving(true);
    setError(null);
    setErrorCtaHref(null);
    setErrorCtaLabel(null);

    const assignmentMode = resourceIdValue ? "PROFESSIONAL_AND_RESOURCE" : "PROFESSIONAL_ONLY";

    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/classes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description,
          durationMinutes: durationValue,
          unitPriceCents: Math.round(unitPriceValue * 100),
          currency: DEFAULT_CURRENCY,
          categoryTag: null,
          locationMode: DEFAULT_LOCATION_MODE,
          kind: creationKind,
          coverImageUrl: coverUrl,
          assignmentMode,
          professionalIds: professionalIdValue ? [professionalIdValue] : [],
          resourceIds: resourceIdValue ? [resourceIdValue] : [],
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, `Erro ao criar ${entityLabel}.`);
        const uiError = mapPaymentGateUiState({
          organizationId,
          errorCode: parsedError.errorCode,
          message: parsedError.message,
          details: parsedError.details,
        });
        setError(uiError.message);
        setErrorCtaHref(uiError.ctaHref);
        setErrorCtaLabel(uiError.ctaLabel);
        return;
      }

      const createdClassId =
        typeof json?.service?.id === "number"
          ? json.service.id
          : typeof json?.class?.id === "number"
            ? json.class.id
            : null;
      if (!createdClassId) {
        throw new Error("Resposta inválida ao criar aula.");
      }
      const detailHref = appendOrganizationIdToHref(`/org/academy/classes/${createdClassId}`, organizationId);
      router.push(detailHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Erro ao criar ${entityLabel}.`);
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <p className={DASHBOARD_LABEL}>Academia</p>
          <h1 className="text-2xl font-semibold text-white">Nova aula</h1>
          <p className={DASHBOARD_MUTED}>
            Cria a aula e, se quiseres, liga logo treinador, campo e fotografia.
          </p>
        </div>

        <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
          <div>
            <label className="text-sm text-white/80">Título</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aula de iniciação"
            />
          </div>

          <div>
            <label className="text-sm text-white/80">Duração</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option} value={String(option)}>
                  {option} min
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
              inputMode="decimal"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
            <p className="text-[11px] text-white/50">Usa 0 para gratuito.</p>
          </div>

          <div>
            <label className="text-sm text-white/80">Descrição</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo (opcional)"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-white/80">Treinador (opcional)</label>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={selectedProfessionalId}
                onChange={(event) => setSelectedProfessionalId(event.target.value)}
              >
                <option value="">Sem treinador definido</option>
                {activeProfessionals.map((professional) => (
                  <option key={professional.id} value={String(professional.id)}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/80">Campo (opcional)</label>
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={selectedResourceId}
                onChange={(event) => setSelectedResourceId(event.target.value)}
              >
                <option value="">Sem campo definido</option>
                {courtOptions.map((resource) => (
                  <option key={resource.id} value={String(resource.linkId)}>
                    {resource.labelText}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-white/80">Fotografia</label>
            <div className="mt-2 flex flex-wrap gap-4">
              <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                {coverPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreviewUrl} alt={`Capa da ${entityLabel}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-white/50">Sem foto</div>
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
                  <span>{coverUrl ? "Substituir foto" : "Adicionar foto"}</span>
                </label>
                {coverUrl && (
                  <button type="button" className={CTA_SECONDARY} onClick={() => setCoverUrl(null)}>
                    Remover foto
                  </button>
                )}
                <p className={DASHBOARD_MUTED}>Imagem quadrada recomendada.</p>
                {uploadingCover && <p className={DASHBOARD_MUTED}>A carregar imagem...</p>}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              <p>{error}</p>
              {errorCtaHref && errorCtaLabel ? (
                <button
                  type="button"
                  onClick={() => router.push(errorCtaHref)}
                  className="mt-3 rounded-full border border-red-200/50 bg-red-200/15 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-200/25"
                >
                  {errorCtaLabel}
                </button>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" className={CTA_PRIMARY} onClick={handleSubmit} disabled={saving || !title.trim()}>
              {saving ? "A criar..." : `Criar ${entityLabel}`}
            </button>
            <button
              type="button"
              className={CTA_SECONDARY}
              onClick={() => router.push(appendOrganizationIdToHref("/org/academy/classes", organizationId))}
            >
              Cancelar
            </button>
          </div>
        </section>
      </div>

      {showCoverCropModal && coverCropFile ? (
        <EventCoverCropModal
          open={showCoverCropModal}
          file={coverCropFile}
          onCancel={handleCoverCropCancel}
          onConfirm={handleCoverCropConfirm}
        />
      ) : null}
    </>
  );
}
