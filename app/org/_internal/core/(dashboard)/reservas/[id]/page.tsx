"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref, parseOrganizationId, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { mapPaymentGateUiState, parseApiError } from "@/lib/payments/paymentGateUi";
import { getEventCoverUrl } from "@/lib/eventCover";
import { AddressCombobox } from "@/components/ui/address-combobox";
import { OryaDateField, OryaTimeField } from "@/components/ui/datetime";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  CTA_DANGER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DURATION_OPTIONS = [30, 60, 90, 120];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Service = {
  id: number;
  policyId?: number | null;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  kind?: string | null;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode?: "FIXED" | "CHOOSE_AT_BOOKING" | null;
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
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

type ServicePackage = {
  id: number;
  label: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  recommended: boolean;
  sortOrder: number;
  isActive: boolean;
};

type ServiceAddon = {
  id: number;
  label: string;
  description: string | null;
  deltaMinutes: number;
  deltaPriceCents: number;
  maxQty: number | null;
  category: string | null;
  sortOrder: number;
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

type CourtItem = {
  id: number;
  name: string | null;
  isActive: boolean;
  padelClubId?: number;
};

type ClassSeriesItem = {
  id: number;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  capacity: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  professional?: { id: number; name: string } | null;
  court?: { id: number; name: string | null; isActive?: boolean | null } | null;
  _count?: { sessions: number };
};

type ClassSessionItem = {
  id: number;
  startsAt: string;
  endsAt: string;
  status: string;
  professional?: { id: number; name: string } | null;
  court?: { id: number; name: string | null; isActive?: boolean | null } | null;
  series?: { id: number };
};

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}


export default function ServicoDetalhePage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationIdFromQuery = parseOrganizationId(searchParams?.get("organizationId"));
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationId = organizationIdFromQuery ?? organizationIdFromPath;
  const idRaw = params?.id;
  const serviceId = useMemo(() => {
    const value = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [idRaw]);

  const serviceKey = serviceId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}`) : null;
  const packsEnabled = false;
  const packsKey = packsEnabled && serviceId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packs`) : null;
  const addonsKey = serviceId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/addons`) : null;
  const packagesKey = serviceId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packages`) : null;
  const classSeriesKey = serviceId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/class-series`) : null;
  const classSessionsKey = serviceId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/class-sessions`) : null;
  const clubsKey = "/api/padel/clubs?includeInactive=1";

  const { data: serviceData, mutate: mutateService } = useSWR<{ ok: boolean; service: Service }>(
    serviceKey,
    fetcher,
  );
  const { data: policiesData } = useSWR<{ ok: boolean; items: PolicyItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/policies"),
    fetcher,
  );
  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/profissionais"),
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/recursos"),
    fetcher,
  );
  const { data: packsData, mutate: mutatePacks } = useSWR<{ ok: boolean; items: ServicePack[] }>(
    packsKey,
    fetcher,
  );
  const { data: addonsData, mutate: mutateAddons } = useSWR<{ ok: boolean; items: ServiceAddon[] }>(
    addonsKey,
    fetcher,
  );
  const { data: packagesData, mutate: mutatePackages } = useSWR<{ ok: boolean; items: ServicePackage[] }>(
    packagesKey,
    fetcher,
  );
  const { data: classSeriesData, mutate: mutateClassSeries } = useSWR<{ ok: boolean; items: ClassSeriesItem[] }>(
    classSeriesKey,
    fetcher,
  );
  const { data: classSessionsData, mutate: mutateClassSessions } = useSWR<{ ok: boolean; items: ClassSessionItem[] }>(
    classSessionsKey,
    fetcher,
  );
  const { data: clubsData } = useSWR<{ ok: boolean; items: { id: number; name: string; isActive: boolean }[] }>(
    clubsKey,
    fetcher,
  );

  const service = serviceData?.service ?? null;
  const packs = packsEnabled ? packsData?.items ?? [] : [];
  const addons = addonsData?.items ?? [];
  const packages = packagesData?.items ?? [];
  const classSeries = classSeriesData?.items ?? [];
  const classSessions = classSessionsData?.items ?? [];
  const clubs = clubsData?.items ?? [];
  const policies = policiesData?.items ?? [];
  const professionals = professionalsData?.items ?? [];
  const resources = resourcesData?.items ?? [];
  const activeProfessionals = professionals.filter((professional) => professional.isActive);
  const activeResources = resources.filter((resource) => resource.isActive);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const courtsKey = selectedClubId ? `/api/padel/clubs/${selectedClubId}/courts` : null;
  const { data: courtsData } = useSWR<{ ok: boolean; items: CourtItem[] }>(courtsKey, fetcher);
  const courts = courtsData?.items ?? [];

  useEffect(() => {
    if (selectedClubId || clubs.length === 0) return;
    const preferred = clubs.find((club) => club.isActive) ?? clubs[0];
    if (preferred) setSelectedClubId(preferred.id);
  }, [clubs, selectedClubId]);

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
  const [formAddressQuery, setFormAddressQuery] = useState("");
  const [formAddressId, setFormAddressId] = useState<string | null>(null);
  const [formAddressLabel, setFormAddressLabel] = useState<string | null>(null);
  const [formPolicyId, setFormPolicyId] = useState("");
  const [linkedProfessionalIds, setLinkedProfessionalIds] = useState<number[]>([]);
  const [linkedResourceIds, setLinkedResourceIds] = useState<number[]>([]);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceErrorCtaHref, setServiceErrorCtaHref] = useState<string | null>(null);
  const [serviceErrorCtaLabel, setServiceErrorCtaLabel] = useState<string | null>(null);

  const [addonLabel, setAddonLabel] = useState("");
  const [addonDescription, setAddonDescription] = useState("");
  const [addonDeltaMinutes, setAddonDeltaMinutes] = useState("15");
  const [addonDeltaPrice, setAddonDeltaPrice] = useState("5");
  const [addonMaxQty, setAddonMaxQty] = useState("");
  const [addonCategory, setAddonCategory] = useState("");
  const [addonSortOrder, setAddonSortOrder] = useState("0");
  const [addonSaving, setAddonSaving] = useState(false);
  const [addonError, setAddonError] = useState<string | null>(null);
  const [addonDrafts, setAddonDrafts] = useState<Record<number, { label: string; description: string; deltaMinutes: string; deltaPrice: string; maxQty: string; category: string; sortOrder: string; isActive: boolean }>>({});
  const [addonSavingId, setAddonSavingId] = useState<number | null>(null);

  const [packageLabel, setPackageLabel] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageDuration, setPackageDuration] = useState("60");
  const [packagePrice, setPackagePrice] = useState("0");
  const [packageRecommended, setPackageRecommended] = useState(true);
  const [packageSortOrder, setPackageSortOrder] = useState("0");
  const [packageSaving, setPackageSaving] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [packageDrafts, setPackageDrafts] = useState<Record<number, { label: string; description: string; durationMinutes: string; price: string; recommended: boolean; sortOrder: string; isActive: boolean }>>({});
  const [packageSavingId, setPackageSavingId] = useState<number | null>(null);

  const [packQuantity, setPackQuantity] = useState("5");
  const [packPrice, setPackPrice] = useState("90");
  const [packLabel, setPackLabel] = useState("");
  const [packRecommended, setPackRecommended] = useState(true);
  const [packSaving, setPackSaving] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [packDrafts, setPackDrafts] = useState<Record<number, { quantity: string; price: string; label: string; recommended: boolean; isActive: boolean }>>({});
  const [packSavingId, setPackSavingId] = useState<number | null>(null);

  const [seriesEditingId, setSeriesEditingId] = useState<number | null>(null);
  const [seriesDay, setSeriesDay] = useState("1");
  const [seriesStartTime, setSeriesStartTime] = useState("18:00");
  const [seriesDuration, setSeriesDuration] = useState("60");
  const [seriesCapacity, setSeriesCapacity] = useState("4");
  const [seriesValidFrom, setSeriesValidFrom] = useState("");
  const [seriesValidUntil, setSeriesValidUntil] = useState("");
  const [seriesProfessionalId, setSeriesProfessionalId] = useState("");
  const [seriesCourtId, setSeriesCourtId] = useState("");
  const [seriesActive, setSeriesActive] = useState(true);
  const [seriesSaving, setSeriesSaving] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

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
    setFormAddressId(service.addressId ?? null);
    setFormAddressLabel(service.addressRef?.formattedAddress ?? null);
    setFormAddressQuery(service.addressRef?.formattedAddress ?? "");
    setFormPolicyId(service.policyId ? String(service.policyId) : "");
    setLinkedProfessionalIds(service.professionalLinks?.map((link) => link.professionalId) ?? []);
    setLinkedResourceIds(service.resourceLinks?.map((link) => link.resourceId) ?? []);
  }, [service]);

  useEffect(() => {
    if (seriesValidFrom) return;
    setSeriesValidFrom(new Date().toISOString().slice(0, 10));
  }, [seriesValidFrom]);

  useEffect(() => {
    if (!addonsData?.items) return;
    const draftMap: Record<number, { label: string; description: string; deltaMinutes: string; deltaPrice: string; maxQty: string; category: string; sortOrder: string; isActive: boolean }> = {};
    addonsData.items.forEach((addon) => {
      draftMap[addon.id] = {
        label: addon.label ?? "",
        description: addon.description ?? "",
        deltaMinutes: String(addon.deltaMinutes ?? 0),
        deltaPrice: ((addon.deltaPriceCents ?? 0) / 100).toFixed(2),
        maxQty: addon.maxQty != null ? String(addon.maxQty) : "",
        category: addon.category ?? "",
        sortOrder: String(addon.sortOrder ?? 0),
        isActive: addon.isActive,
      };
    });
    setAddonDrafts(draftMap);
  }, [addonsData?.items]);

  useEffect(() => {
    if (!packagesData?.items) return;
    const draftMap: Record<number, { label: string; description: string; durationMinutes: string; price: string; recommended: boolean; sortOrder: string; isActive: boolean }> = {};
    packagesData.items.forEach((pkg) => {
      draftMap[pkg.id] = {
        label: pkg.label ?? "",
        description: pkg.description ?? "",
        durationMinutes: String(pkg.durationMinutes ?? 0),
        price: ((pkg.priceCents ?? 0) / 100).toFixed(2),
        recommended: pkg.recommended,
        sortOrder: String(pkg.sortOrder ?? 0),
        isActive: pkg.isActive,
      };
    });
    setPackageDrafts(draftMap);
  }, [packagesData?.items]);

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
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const parsedError = parseApiError(json, "Não foi possível atualizar o serviço.");
      const uiError = mapPaymentGateUiState({
        organizationId,
        errorCode: parsedError.errorCode,
        message: parsedError.message,
        details: parsedError.details,
      });
      setServiceError(uiError.message);
      setServiceErrorCtaHref(uiError.ctaHref);
      setServiceErrorCtaLabel(uiError.ctaLabel);
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
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!organizationId) {
        throw new Error("Organização inválida.");
      }
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
      console.error("Erro upload cover", err);
      setServiceError(err instanceof Error ? err.message : "Não foi possível carregar a imagem.");
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
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
    setServiceError(null);
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    if (formLocationMode === "FIXED" && !formAddressId) {
      setServiceError("Seleciona uma morada Apple Maps.");
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
      return;
    }
    setServiceSaving(true);

    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}`), {
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
          addressId: formLocationMode === "FIXED" ? formAddressId : null,
          policyId: formPolicyId ? Number(formPolicyId) : null,
          professionalIds: linkedProfessionalIds,
          resourceIds: linkedResourceIds,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, "Erro ao guardar serviço.");
        const uiError = mapPaymentGateUiState({
          organizationId,
          errorCode: parsedError.errorCode,
          message: parsedError.message,
          details: parsedError.details,
        });
        setServiceError(uiError.message);
        setServiceErrorCtaHref(uiError.ctaHref);
        setServiceErrorCtaLabel(uiError.ctaLabel);
        return;
      }
      mutateService();
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "Erro ao guardar serviço.");
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
    } finally {
      setServiceSaving(false);
    }
  };

  const handleAddonCreate = async () => {
    if (!serviceId) return;
    setAddonSaving(true);
    setAddonError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/addons`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: addonLabel.trim(),
          description: addonDescription.trim(),
          deltaMinutes: Math.round(Number(addonDeltaMinutes)),
          deltaPriceCents: Math.round(Number(addonDeltaPrice) * 100),
          maxQty: addonMaxQty.trim() ? Math.round(Number(addonMaxQty)) : null,
          category: addonCategory.trim(),
          sortOrder: Math.round(Number(addonSortOrder)),
          isActive: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.addon) {
        throw new Error(json?.error || "Erro ao criar add-on.");
      }
      setAddonLabel("");
      setAddonDescription("");
      setAddonDeltaMinutes("15");
      setAddonDeltaPrice("5");
      setAddonMaxQty("");
      setAddonCategory("");
      setAddonSortOrder("0");
      mutateAddons();
    } catch (err) {
      setAddonError(err instanceof Error ? err.message : "Erro ao criar add-on.");
    } finally {
      setAddonSaving(false);
    }
  };

  const handleAddonUpdate = async (addonId: number) => {
    if (!serviceId) return;
    const draft = addonDrafts[addonId];
    if (!draft) return;
    setAddonSavingId(addonId);
    setAddonError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/addons/${addonId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: draft.label,
          description: draft.description,
          deltaMinutes: Math.round(Number(draft.deltaMinutes)),
          deltaPriceCents: Math.round(Number(draft.deltaPrice) * 100),
          maxQty: draft.maxQty.trim() ? Math.round(Number(draft.maxQty)) : null,
          category: draft.category,
          sortOrder: Math.round(Number(draft.sortOrder)),
          isActive: draft.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.addon) {
        throw new Error(json?.error || "Erro ao atualizar add-on.");
      }
      mutateAddons();
    } catch (err) {
      setAddonError(err instanceof Error ? err.message : "Erro ao atualizar add-on.");
    } finally {
      setAddonSavingId(null);
    }
  };

  const handleAddonDisable = async (addonId: number) => {
    if (!serviceId) return;
    await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/addons/${addonId}`), {
      method: "DELETE",
    });
    mutateAddons();
  };

  const handlePackageCreate = async () => {
    if (!serviceId) return;
    setPackageSaving(true);
    setPackageError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: packageLabel.trim(),
          description: packageDescription.trim(),
          durationMinutes: Math.round(Number(packageDuration)),
          priceCents: Math.round(Number(packagePrice) * 100),
          recommended: packageRecommended,
          sortOrder: Math.round(Number(packageSortOrder)),
          isActive: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.package) {
        throw new Error(json?.error || "Erro ao criar pacote.");
      }
      setPackageLabel("");
      setPackageDescription("");
      setPackageDuration("60");
      setPackagePrice("0");
      setPackageRecommended(true);
      setPackageSortOrder("0");
      mutatePackages();
    } catch (err) {
      setPackageError(err instanceof Error ? err.message : "Erro ao criar pacote.");
    } finally {
      setPackageSaving(false);
    }
  };

  const handlePackageUpdate = async (packageId: number) => {
    if (!serviceId) return;
    const draft = packageDrafts[packageId];
    if (!draft) return;
    setPackageSavingId(packageId);
    setPackageError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packages/${packageId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: draft.label,
          description: draft.description,
          durationMinutes: Math.round(Number(draft.durationMinutes)),
          priceCents: Math.round(Number(draft.price) * 100),
          recommended: draft.recommended,
          sortOrder: Math.round(Number(draft.sortOrder)),
          isActive: draft.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.package) {
        throw new Error(json?.error || "Erro ao atualizar pacote.");
      }
      mutatePackages();
    } catch (err) {
      setPackageError(err instanceof Error ? err.message : "Erro ao atualizar pacote.");
    } finally {
      setPackageSavingId(null);
    }
  };

  const handlePackageDisable = async (packageId: number) => {
    if (!serviceId) return;
    await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packages/${packageId}`), {
      method: "DELETE",
    });
    mutatePackages();
  };

  const handlePackCreate = async () => {
    if (!serviceId) return;
    setPackSaving(true);
    setPackError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packs`), {
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
        throw new Error(json?.error || "Erro ao criar pacote.");
      }
      setPackQuantity("5");
      setPackPrice("90");
      setPackLabel("");
      setPackRecommended(true);
      mutatePacks();
    } catch (err) {
      setPackError(err instanceof Error ? err.message : "Erro ao criar pacote.");
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
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packs/${packId}`), {
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
        throw new Error(json?.error || "Erro ao atualizar pacote.");
      }
      mutatePacks();
    } catch (err) {
      setPackError(err instanceof Error ? err.message : "Erro ao atualizar pacote.");
    } finally {
      setPackSavingId(null);
    }
  };

  const handlePackDisable = async (packId: number) => {
    if (!serviceId) return;
    await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/packs/${packId}`), {
      method: "DELETE",
    });
    mutatePacks();
  };

  const resetSeriesForm = () => {
    setSeriesEditingId(null);
    setSeriesDay("1");
    setSeriesStartTime("18:00");
    setSeriesDuration("60");
    setSeriesCapacity("4");
    setSeriesValidFrom(new Date().toISOString().slice(0, 10));
    setSeriesValidUntil("");
    setSeriesProfessionalId("");
    setSeriesCourtId("");
    setSeriesActive(true);
    setSeriesError(null);
  };

  const handleSeriesEdit = (series: ClassSeriesItem) => {
    const hour = Math.floor(series.startMinute / 60);
    const minute = series.startMinute % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    setSeriesEditingId(series.id);
    setSeriesDay(String(series.dayOfWeek));
    setSeriesStartTime(`${pad(hour)}:${pad(minute)}`);
    setSeriesDuration(String(series.durationMinutes));
    setSeriesCapacity(String(series.capacity));
    setSeriesValidFrom(series.validFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setSeriesValidUntil(series.validUntil ? series.validUntil.slice(0, 10) : "");
    setSeriesProfessionalId(series.professional?.id ? String(series.professional.id) : "");
    setSeriesCourtId(series.court?.id ? String(series.court.id) : "");
    setSeriesActive(series.isActive);
    setSeriesError(null);
  };

  const handleSeriesSubmit = async () => {
    if (!serviceId) return;
    const [hourStr, minuteStr] = seriesStartTime.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      setSeriesError("Hora inválida.");
      return;
    }
    if (!seriesValidFrom) {
      setSeriesError("Seleciona a data inicial.");
      return;
    }
    const startMinute = hour * 60 + minute;
    const payload = {
      dayOfWeek: Number(seriesDay),
      startMinute,
      durationMinutes: Number(seriesDuration),
      capacity: Number(seriesCapacity),
      validFrom: seriesValidFrom,
      validUntil: seriesValidUntil || null,
      professionalId: seriesProfessionalId ? Number(seriesProfessionalId) : null,
      courtId: seriesCourtId ? Number(seriesCourtId) : null,
      isActive: seriesActive,
    };

    setSeriesSaving(true);
    setSeriesError(null);
    try {
      const url = seriesEditingId
        ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/class-series/${seriesEditingId}`)
        : resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/class-series`);
      const res = await fetch(url, {
        method: seriesEditingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao guardar série.");
      }
      mutateClassSeries();
      mutateClassSessions();
      resetSeriesForm();
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : "Erro ao guardar série.");
    } finally {
      setSeriesSaving(false);
    }
  };

  const handleSeriesToggle = async (series: ClassSeriesItem, next: boolean) => {
    if (!serviceId) return;
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/servicos/${serviceId}/class-series/${series.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar série.");
      }
      mutateClassSeries();
      mutateClassSessions();
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : "Erro ao atualizar série.");
    }
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
              onChange={(e) => {
                const next = e.target.value as LocationMode;
                setFormLocationMode(next);
                if (next !== "FIXED") {
                  setFormAddressId(null);
                  setFormAddressLabel(null);
                  setFormAddressQuery("");
                }
              }}
            >
              <option value="FIXED">Local fixo</option>
              <option value="CHOOSE_AT_BOOKING">Escolher na marcação</option>
            </select>
          </div>
          {formLocationMode === "FIXED" && (
            <div>
              <AddressCombobox
                label="Morada (Apple Maps)"
                className="mt-1"
                value={formAddressQuery}
                onValueChange={(next) => {
                  setFormAddressQuery(next);
                  if (!next.trim()) {
                    setFormAddressLabel(null);
                  }
                }}
                addressId={formAddressId}
                onAddressIdChange={(next) => {
                  setFormAddressId(next);
                  if (!next) {
                    setFormAddressLabel(null);
                  }
                }}
                onDetailsResolved={(details: GeoDetailsItem | null) => {
                  if (!details?.addressId) {
                    setFormAddressLabel(null);
                    return;
                  }
                  setFormAddressLabel(details.formattedAddress?.trim() || details.address?.trim() || null);
                }}
                minChars={2}
                maxItems={10}
                enableRecents
                enableGeolocationCta
              />
              {formAddressId && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                  Morada confirmada: {formAddressLabel || formAddressQuery}
                </div>
              )}
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
                {policy.name}
              </option>
            ))}
          </select>
        </div>

        {serviceError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            <p>{serviceError}</p>
            {serviceErrorCtaHref && serviceErrorCtaLabel ? (
              <button
                type="button"
                onClick={() => router.push(serviceErrorCtaHref)}
                className="mt-3 rounded-full border border-red-200/50 bg-red-200/15 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-200/25"
              >
                {serviceErrorCtaLabel}
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={CTA_PRIMARY} onClick={handleServiceSave} disabled={serviceSaving}>
            {serviceSaving ? "A guardar..." : "Guardar alterações"}
          </button>
          <button
            type="button"
            className={CTA_SECONDARY}
            onClick={() => router.push(appendOrganizationIdToHref("/org/bookings", organizationId))}
          >
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

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Pacotes</h2>
          <p className={DASHBOARD_MUTED}>
            Cria pacotes com duração e preço fixos. Útil para experiências e festas.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/80">Nome do pacote</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={packageLabel}
              onChange={(e) => setPackageLabel(e.target.value)}
              placeholder="Ex: Pacote Festa Premium"
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Descrição (opcional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={packageDescription}
              onChange={(e) => setPackageDescription(e.target.value)}
              placeholder="Ex: inclui animador e bolo"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm text-white/80">Duração (min)</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={packageDuration}
              onChange={(e) => setPackageDuration(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Preço</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={packagePrice}
              onChange={(e) => setPackagePrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Ordem</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={packageSortOrder}
              onChange={(e) => setPackageSortOrder(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={packageRecommended}
                onChange={(e) => setPackageRecommended(e.target.checked)}
              />
              Recomendado
            </label>
          </div>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            className={CTA_PRIMARY}
            onClick={handlePackageCreate}
            disabled={packageSaving}
          >
            {packageSaving ? "A criar..." : "Criar pacote"}
          </button>
        </div>

        {packageError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {packageError}
          </div>
        )}

        <div className="space-y-3">
          {packages.length === 0 && (
            <p className="text-[12px] text-white/60">Sem pacotes criados.</p>
          )}
          {packages.map((pkg) => {
            const draft = packageDrafts[pkg.id];
            if (!draft) return null;
            return (
              <div key={pkg.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {draft.label || pkg.label}
                    </p>
                    <p className="text-[12px] text-white/60">
                      {draft.durationMinutes || pkg.durationMinutes} min ·{" "}
                      {draft.price
                        ? `${draft.price} ${service?.currency ?? "EUR"}`
                        : formatMoney(pkg.priceCents, service?.currency ?? "EUR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/50">
                    {draft.recommended ? <span>Recomendado</span> : null}
                    <span>{pkg.isActive ? "Ativo" : "Inativo"}</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-[12px] text-white/70">
                    Nome
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.label}
                      onChange={(e) =>
                        setPackageDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, label: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-white/70">
                    Descrição
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.description}
                      onChange={(e) =>
                        setPackageDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, description: e.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[12px] text-white/70">
                    Duração (min)
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.durationMinutes}
                      onChange={(e) =>
                        setPackageDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, durationMinutes: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-white/70">
                    Preço
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.price}
                      onChange={(e) =>
                        setPackageDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, price: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-white/70">
                    Ordem
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.sortOrder}
                      onChange={(e) =>
                        setPackageDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, sortOrder: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-white/70">
                    <input
                      type="checkbox"
                      checked={draft.recommended}
                      onChange={(e) =>
                        setPackageDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, recommended: e.target.checked },
                        }))
                      }
                    />
                    Recomendado
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-[12px] text-white/70">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) =>
                        setPackageDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, isActive: e.target.checked },
                        }))
                      }
                    />
                    Ativo
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={CTA_PRIMARY}
                    onClick={() => handlePackageUpdate(pkg.id)}
                    disabled={packageSavingId === pkg.id}
                  >
                    {packageSavingId === pkg.id ? "A guardar..." : "Guardar"}
                  </button>
                  <button type="button" className={CTA_DANGER} onClick={() => handlePackageDisable(pkg.id)}>
                    Desativar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Extras (add-ons)</h2>
          <p className={DASHBOARD_MUTED}>
            Cria extras que ajustam tempo e preço. Os clientes escolhem ao reservar.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/80">Nome do extra</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={addonLabel}
              onChange={(e) => setAddonLabel(e.target.value)}
              placeholder="Ex: Barba"
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Descrição (opcional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={addonDescription}
              onChange={(e) => setAddonDescription(e.target.value)}
              placeholder="Ex: acabamento premium"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm text-white/80">+Minutos</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={addonDeltaMinutes}
              onChange={(e) => setAddonDeltaMinutes(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">+Preço</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={addonDeltaPrice}
              onChange={(e) => setAddonDeltaPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Max qty (opcional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={addonMaxQty}
              onChange={(e) => setAddonMaxQty(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Ordem</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={addonSortOrder}
              onChange={(e) => setAddonSortOrder(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/80">Categoria (opcional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={addonCategory}
              onChange={(e) => setAddonCategory(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className={CTA_PRIMARY}
              onClick={handleAddonCreate}
              disabled={addonSaving}
            >
              {addonSaving ? "A criar..." : "Criar extra"}
            </button>
          </div>
        </div>

        {addonError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {addonError}
          </div>
        )}

        <div className="space-y-3">
          {addons.length === 0 && (
            <p className="text-[12px] text-white/60">Sem extras criados.</p>
          )}
          {addons.map((addon) => {
            const draft = addonDrafts[addon.id];
            if (!draft) return null;
            return (
              <div key={addon.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {draft.label || addon.label}
                    </p>
                    <p className="text-[12px] text-white/60">
                      +{draft.deltaMinutes || addon.deltaMinutes} min ·{" "}
                      {draft.deltaPrice
                        ? `${draft.deltaPrice} ${service?.currency ?? "EUR"}`
                        : formatMoney(addon.deltaPriceCents, service?.currency ?? "EUR")}
                    </p>
                  </div>
                  <span className="text-[11px] text-white/50">{addon.isActive ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-[12px] text-white/70">
                    Nome
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.label}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, label: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-white/70">
                    Descrição
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.description}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, description: e.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[12px] text-white/70">
                    +Minutos
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.deltaMinutes}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, deltaMinutes: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-white/70">
                    +Preço
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.deltaPrice}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, deltaPrice: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-white/70">
                    Max qty
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.maxQty}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, maxQty: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-white/70">
                    Ordem
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.sortOrder}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, sortOrder: e.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-[12px] text-white/70">
                    Categoria
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={draft.category}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, category: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-white/70">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) =>
                        setAddonDrafts((prev) => ({
                          ...prev,
                          [addon.id]: { ...draft, isActive: e.target.checked },
                        }))
                      }
                    />
                    Ativo
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={CTA_PRIMARY}
                    onClick={() => handleAddonUpdate(addon.id)}
                    disabled={addonSavingId === addon.id}
                  >
                    {addonSavingId === addon.id ? "A guardar..." : "Guardar"}
                  </button>
                  <button type="button" className={CTA_DANGER} onClick={() => handleAddonDisable(addon.id)}>
                    Desativar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {service?.kind === "CLASS" && (
        <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Aulas recorrentes</h2>
              <p className={DASHBOARD_MUTED}>Cria séries e gere sessões automaticamente.</p>
            </div>
            {seriesEditingId && (
              <button type="button" className={CTA_SECONDARY} onClick={resetSeriesForm}>
                Cancelar edição
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] text-white/70">
              Dia da semana
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesDay}
                onChange={(e) => setSeriesDay(e.target.value)}
              >
                {DAY_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Hora
              <OryaTimeField
                value={seriesStartTime}
                onChange={setSeriesStartTime}
                stepMinutes={15}
                className="mt-1 w-full"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Duração (min)
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesDuration}
                onChange={(e) => setSeriesDuration(e.target.value)}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Capacidade
              <input
                type="number"
                min="1"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesCapacity}
                onChange={(e) => setSeriesCapacity(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] text-white/70">
              Válido desde
              <OryaDateField
                value={seriesValidFrom}
                onChange={setSeriesValidFrom}
                className="mt-1 w-full"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Válido até
              <OryaDateField
                value={seriesValidUntil}
                onChange={setSeriesValidUntil}
                minDate={seriesValidFrom || undefined}
                className="mt-1 w-full"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Profissional
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesProfessionalId}
                onChange={(e) => setSeriesProfessionalId(e.target.value)}
              >
                <option value="">Sem profissional</option>
                {activeProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Campo (opcional)
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesCourtId}
                onChange={(e) => setSeriesCourtId(e.target.value)}
                disabled={courts.length === 0}
              >
                <option value="">Sem campo</option>
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name || `Campo ${court.id}`}{court.isActive ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {clubs.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-[12px] text-white/70">
                Clube
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={selectedClubId ?? ""}
                  onChange={(e) => setSelectedClubId(Number(e.target.value))}
                >
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}{club.isActive ? "" : " (inativo)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-[12px] text-white/70">
            <input
              type="checkbox"
              checked={seriesActive}
              onChange={(e) => setSeriesActive(e.target.checked)}
            />
            Série ativa
          </label>

          {seriesError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {seriesError}
            </div>
          )}

          <button type="button" className={CTA_PRIMARY} onClick={handleSeriesSubmit} disabled={seriesSaving}>
            {seriesSaving ? "A guardar..." : seriesEditingId ? "Guardar série" : "Criar série"}
          </button>

          <div className="space-y-3">
            {classSeries.length === 0 && (
              <p className="text-[12px] text-white/60">Sem séries criadas.</p>
            )}
            {classSeries.map((series) => {
              const hour = Math.floor(series.startMinute / 60);
              const minute = series.startMinute % 60;
              const pad = (value: number) => String(value).padStart(2, "0");
              return (
                <div key={series.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {DAY_LABELS[series.dayOfWeek]} · {pad(hour)}:{pad(minute)} · {series.durationMinutes} min
                      </p>
                      <p className="text-[12px] text-white/60">
                        Capacidade {series.capacity}
                        {series.professional?.name ? ` · ${series.professional.name}` : ""}
                        {series.court?.name ? ` · ${series.court.name}${series.court.isActive === false ? " (inativo)" : ""}` : ""}
                      </p>
                      <p className="text-[11px] text-white/45">
                        Válido: {series.validFrom.slice(0, 10)}
                        {series.validUntil ? ` → ${series.validUntil.slice(0, 10)}` : ""}
                      </p>
                      <p className="text-[11px] text-white/45">
                        Sessões: {series._count?.sessions ?? 0}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                      <span>{series.isActive ? "Ativa" : "Inativa"}</span>
                      <button
                        type="button"
                        className={CTA_SECONDARY}
                        onClick={() => handleSeriesEdit(series)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={CTA_DANGER}
                        onClick={() => handleSeriesToggle(series, !series.isActive)}
                      >
                        {series.isActive ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] text-white/60">Próximas sessões</p>
            {classSessions.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem sessões futuras.</p>
            ) : (
              <div className="space-y-2">
                {classSessions.slice(0, 10).map((session) => (
                  <div key={session.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                    {new Date(session.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                    {session.professional?.name ? ` · ${session.professional.name}` : ""}
                    {session.court?.name ? ` · ${session.court.name}${session.court.isActive === false ? " (inativo)" : ""}` : ""}
                    {session.status ? ` · ${session.status}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {packsEnabled && (
        <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
          <div>
            <h2 className="text-base font-semibold text-white">Packs de sessões</h2>
            <p className={DASHBOARD_MUTED}>Opcional, sempre do mesmo serviço (sem carteira monetária).</p>
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
            {packSaving ? "A criar..." : "Criar pacote"}
          </button>

          <div className="space-y-3">
            {packs.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Sem pacotes criados.
              </div>
            )}
            {packs.map((pack) => {
              const draft = packDrafts[pack.id];
              return (
                <div key={pack.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {draft?.label || pack.label || "Pacote"} · {draft?.quantity ?? pack.quantity} unidades
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
